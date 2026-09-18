/**
 * Calculates the Admin Subscription Fee based on active referrals.
 * Base fee is R 299.99.
 * Increases by R 299.99 for every 100 successful referrals that paid their tenant subscription.
 */
export function calculateAdminFee(activeReferrals: number): number {
  const baseFee = 299.99;
  const tiers = Math.floor(activeReferrals / 100);
  return baseFee + (tiers * 299.99);
}

/**
 * Generates and downloads a text file of the accepted Tenant Agreement.
 */
export function downloadTenantAgreement(tenantName: string, tenantEmail: string, acceptedAt: string, agreementText: string) {
  const content = `TIMEGIG TENANT AGREEMENT - EXECUTED COPY\n\n` +
    `TENANT DETAILS:\n` +
    `Full Name: ${tenantName}\n` +
    `Email: ${tenantEmail}\n` +
    `Accepted Date: ${new Date(acceptedAt).toLocaleString()}\n\n` +
    `--------------------------------------------------\n\n` +
    agreementText +
    `\n\n--------------------------------------------------\n` +
    `ELECTRONIC RECORD OF ACCEPTANCE\n` +
    `This document confirms that ${tenantName} (${tenantEmail}) accepted the TimeGig Tenant Agreement electronically on ${new Date(acceptedAt).toISOString()}.\n`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `TimeGig_Agreement_${tenantName.replace(/\s+/g, '_')}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
