export type WithdrawalStatus = 'pending' | 'approved' | 'completed' | 'rejected';

export interface RiderPaymentAccountInfo {
  bank: string;
  phone?: string;
  nationalId?: string;
  accountNumber?: string;
  holderName?: string;
  type?: string;
}

export interface RiderWithdrawal {
  id: string;
  riderId: string;
  riderName: string;
  riderPhone?: string;
  tenantId?: string;
  merchantName: string;
  branchId?: string;
  amount: number;
  currency: string;
  amountBs?: number;
  accountType: string;
  paymentAccount: RiderPaymentAccountInfo;
  status: WithdrawalStatus;
  referenceCode?: string;
  rejectionReason?: string;
  notes?: string;
  requestedAt: string;
  processedAt?: string;
}

