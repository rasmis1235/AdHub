import { query, transaction } from '../config/database';
import { cacheDel, CacheKeys } from '../config/redis';
import { AppError } from '../api/middleware/error.middleware';
import { emailService } from './email.service';
import { encrypt, decrypt } from '../utils/crypto';
import { Withdrawal, WithdrawalMethod } from '../types';

export interface WithdrawalRequest {
  points: number;
  method: WithdrawalMethod;
  accountDetails: Record<string, string>;
}

// Points to INR conversion rate
const POINTS_TO_INR = 0.01; // 100 points = ₹1

export const withdrawalService = {
  async requestWithdrawal(
    userId: string,
    payload: WithdrawalRequest,
    ip: string
  ): Promise<Withdrawal> {
    const { points, method, accountDetails } = payload;

    // Get platform settings
    const { rows: settings } = await query<{ key: string; value: Record<string, number> }>(
      `SELECT key, value FROM platform_settings
       WHERE key IN ('min_withdrawal_points', 'withdrawal_fee_percent', 'withdrawal_enabled')`,
    );

    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    if (!settingsMap['withdrawal_enabled']?.enabled) {
      throw new AppError('Withdrawals are temporarily disabled', 503);
    }

    const minPoints = settingsMap['min_withdrawal_points']?.amount || 5000;
    if (points < minPoints) {
      throw new AppError(`Minimum withdrawal is ${minPoints} points (₹${minPoints * POINTS_TO_INR})`, 400);
    }

    // Lock user row to check balance
    const result = await transaction(async (client) => {
      const { rows: userRows } = await client.query<{
        id: string; email: string; full_name: string; available_points: number;
      }>(
        `SELECT id, email, full_name, available_points FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      const user = userRows[0];
      if (user.available_points < points) {
        throw new AppError(`Insufficient points. Available: ${user.available_points}`, 400);
      }

      // Check pending withdrawal
      const { rows: pending } = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM withdrawals
         WHERE user_id = $1 AND status IN ('pending', 'processing')`,
        [userId]
      );
      if (parseInt(pending[0]?.count || '0') > 0) {
        throw new AppError('You have a pending withdrawal. Wait for it to complete.', 400);
      }

      const feePercent = settingsMap['withdrawal_fee_percent']?.fee || 2;
      const pointsFee = Math.ceil(points * (feePercent / 100));
      const pointsNet = points - pointsFee;
      const amountInr = parseFloat((pointsNet * POINTS_TO_INR).toFixed(2));

      // Encrypt account details
      const encryptedDetails = encrypt(JSON.stringify(accountDetails));

      // Deduct points immediately (hold)
      await client.query(
        `UPDATE users SET available_points = available_points - $1 WHERE id = $2`,
        [points, userId]
      );

      const { rows: withdrawalRows } = await client.query<Withdrawal>(
        `INSERT INTO withdrawals
           (user_id, points_requested, points_fee, points_net, amount_inr, method,
            account_details, status, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
         RETURNING *`,
        [userId, points, pointsFee, pointsNet, amountInr, method,
         JSON.stringify({ encrypted: encryptedDetails }), ip]
      );

      const withdrawal = withdrawalRows[0];

      // Record transaction
      await client.query(
        `INSERT INTO point_transactions
           (user_id, type, status, points, balance_before, balance_after, withdrawal_id, description)
         VALUES ($1, 'withdrawal', 'pending', $2, $3, $4, $5, $6)`,
        [
          userId, -points, user.available_points,
          user.available_points - points, withdrawal.id,
          `Withdrawal request - ₹${amountInr}`,
        ]
      );

      return { withdrawal, user };
    });

    await cacheDel(CacheKeys.user(userId));

    return result.withdrawal;
  },

  async processWithdrawal(
    withdrawalId: string,
    adminId: string,
    action: 'approve' | 'reject',
    note?: string,
    paymentReference?: string
  ): Promise<void> {
    const { rows } = await query<Withdrawal & { email: string; full_name: string }>(
      `SELECT w.*, u.email, u.full_name FROM withdrawals w
       JOIN users u ON w.user_id = u.id
       WHERE w.id = $1 AND w.status = 'pending'`,
      [withdrawalId]
    );
    if (!rows[0]) throw new AppError('Withdrawal not found or already processed', 404);

    const withdrawal = rows[0];

    await transaction(async (client) => {
      if (action === 'approve') {
        await client.query(
          `UPDATE withdrawals SET
             status = 'completed', admin_id = $1, admin_note = $2,
             payment_reference = $3, paid_at = NOW(), processed_at = NOW()
           WHERE id = $4`,
          [adminId, note, paymentReference, withdrawalId]
        );

        // Update point transaction status
        await client.query(
          `UPDATE point_transactions SET status = 'completed'
           WHERE withdrawal_id = $1`,
          [withdrawalId]
        );

        // Update total_withdrawn
        await client.query(
          `UPDATE users SET total_withdrawn = total_withdrawn + $1 WHERE id = $2`,
          [withdrawal.points_requested, withdrawal.user_id]
        );
      } else {
        // Refund points on rejection
        await client.query(
          `UPDATE withdrawals SET
             status = 'rejected', admin_id = $1, admin_note = $2, processed_at = NOW()
           WHERE id = $3`,
          [adminId, note, withdrawalId]
        );

        await client.query(
          `UPDATE users SET available_points = available_points + $1 WHERE id = $2`,
          [withdrawal.points_requested, withdrawal.user_id]
        );

        await client.query(
          `UPDATE point_transactions SET status = 'reversed'
           WHERE withdrawal_id = $1`,
          [withdrawalId]
        );
      }
    });

    await cacheDel(CacheKeys.user(withdrawal.user_id));

    if (action === 'approve' && withdrawal.email && paymentReference) {
      emailService
        .sendWithdrawalConfirmation(
          withdrawal.email,
          withdrawal.full_name,
          withdrawal.amount_inr?.toString() || '0',
          withdrawal.method,
          paymentReference
        )
        .catch(() => {});
    }
  },

  async getWithdrawals(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ withdrawals: Partial<Withdrawal>[]; total: number }> {
    const offset = (page - 1) * limit;
    const { rows } = await query<Withdrawal & { total: string }>(
      `SELECT id, points_requested, points_net, amount_inr, method, status,
              payment_reference, requested_at, paid_at, created_at,
              COUNT(*) OVER() as total
       FROM withdrawals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      withdrawals: rows,
      total: rows.length > 0 ? parseInt(rows[0].total || '0') : 0,
    };
  },

  decryptAccountDetails(encrypted: string): Record<string, string> {
    try {
      return JSON.parse(decrypt(encrypted)) as Record<string, string>;
    } catch {
      return {};
    }
  },
};
