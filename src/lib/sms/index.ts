// ==================== SMS MODULE — INDEX ====================
// SMS functionality is not yet configured. Install twilio and create twilio.ts to enable.

export const isSmsConfigured = () => false;
export const sendVerificationSms = async () => ({ success: false, error: 'SMS not configured' });
export const verifySmsCode = async () => ({ valid: false, error: 'SMS not configured' });
export const generateVerificationCode = () => '';
export const isValidPhoneNumber = () => false;
export const formatPhoneDisplay = (phone: string) => phone;
export const getTwilioConfig = () => null;