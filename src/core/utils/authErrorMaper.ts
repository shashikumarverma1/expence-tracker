import { t } from 'i18next';
import { FirebaseAuthError } from '../enum/eFireBaseAuthErrors';

export function getAuthErrorMessage(error: any): string {
    const code: string = error?.code ?? '';
    switch (code) {
        case FirebaseAuthError.UserNotFound:
        case FirebaseAuthError.WrongPassword:
        case FirebaseAuthError.InvalidCredential:
        case FirebaseAuthError.MissingPassword:
            return t('auth.err_invalid_credentials');
        case FirebaseAuthError.EmailAlreadyInUse:
            return t('auth.err_email_in_use');
        case FirebaseAuthError.InvalidEmail:
            return t('auth.err_invalid_email');
        case FirebaseAuthError.UserDisabled:
            return t('auth.err_user_disabled');
        case FirebaseAuthError.TooManyRequests:
            return t('auth.err_too_many_requests');
        case FirebaseAuthError.NetworkRequestFailed:
            return t('auth.err_network');
        case FirebaseAuthError.WeakPassword:
            return t('auth.err_weak_password');
        case FirebaseAuthError.RequiresRecentLogin:
            return t('requires_recent_login');
        case FirebaseAuthError.PopupClosedByUser:
            return t('auth.err_popup_closed');
        case FirebaseAuthError.AccountExistsWithDifferentCredential:
            return t('auth.err_account_exists_different');
        default:
            return t('auth.err_unknown');
    }
}
