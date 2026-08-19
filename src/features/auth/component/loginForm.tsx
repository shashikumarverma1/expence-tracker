import React, { memo, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';

import { Formik } from 'formik';
import * as Yup from 'yup';

import { CButton, CTextInput, CLoading, Logo } from '../../../core/component';
import CText from '../../../core/component/CText';
import { AppColors, font, shadow } from '../../../core/utils';

import { useTheme } from '../../../core/hook';
import { useAuthHook, useGoogleAuth } from '../hooks';
import { navigate } from '../../../navigation/navigationRef';
import { ForgotPasswordModal } from './ForgotPasswordModal';


const loginSchema = Yup.object().shape({
  email: Yup.string().email('email-invalid').required('email-required'),
  password: Yup.string().required('password-required'),
});

function LoginScreen({ onToggle }: { onToggle: () => void }) {
   const { mode, colors, toggleTheme } = useTheme();
     const styles = makeStyles(colors); 
  const { signIn, loading, resetPassword, resetLoading } = useAuthHook();
  const isLoading = loading;
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  return (
    <>
      <CLoading visible={isLoading} variant="compact" message="Please wait…" />
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          {/* <View style={styles.logoCircle}>
            <View style={styles.micIcon}>
              <View style={styles.micBody} />
              <View style={styles.micBase} />
              <View style={styles.micStand} />
            </View>
          </View>
          <CText style={styles.appName}>VoiceJournal AI</CText>
          <CText style={styles.tagline}>Your daily voice diary</CText> */}
          <Logo w={200} h={200} r={100}/>
        </View>

        <Formik
          initialValues={{ email: '', password: '' }}
          validationSchema={loginSchema}
          onSubmit={(values) => {
            console.log(values);
            signIn(values)
            // TODO: call Signin hook
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, handleSubmit, submitCount }) => (
            <>
              <View style={styles.form}>
                <CTextInput
                  label="email"
                  status={(touched.email || submitCount > 0) && errors.email ? 'error' : undefined}
                  errorMessage={(touched.email || submitCount > 0) && errors.email ? errors.email : undefined}
                  ptx="email-address"
                  value={values.email}
                  onChangeText={handleChange('email')}
                  onBlur={handleBlur('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <CTextInput
                  label="password"
                  ptx="password"
                  value={values.password}
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  isPassword
                  status={(touched.password || submitCount > 0) && errors.password ? 'error' : undefined}
                  errorMessage={(touched.password || submitCount > 0) && errors.password ? errors.password : undefined}
                />

                <CButton
                  tx="auth.forgot_password"
                  onPress={() => setShowForgotPassword(true)}
                  variant="link"
                  color="primary"
                  size="sm"
                  fullWidth={false}
                  containerStyle={styles.forgotPasswordBtn}
                />

                <CButton
                  tx="signin"
                  onPress={handleSubmit}
                  color="primary"

                  size="md"
                />

                {/* Google sign-in temporarily disabled
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <CText tx="auth.or" style={styles.dividerText} />
                  <View style={styles.dividerLine} />
                </View>

                <CButton
                  tx="signin-with-google"
                  onPress={signInWithGoogle}
                  color="danger"
                  size="md"
                />
                */}
              </View>

              <View style={styles.footer}>
                <CText style={styles.footerText} tx="dont-have-account" />
                <CButton
                  tx="register"
                  onPress={onToggle}
                  variant="link"
                  color="primary"
                  size="sm"
                  fullWidth={false} />
              </View>

              <View style={styles.legalFooter}>
                <CButton
                  txt="Privacy Policy"
                  onPress={() => navigate('PrivacyPolicyScreen')}
                  variant="link"
                  color="primary"
                  size="sm"
                  fullWidth={false}
                />
                <CText style={styles.legalSeparator} txt="•" />
                <CButton
                  txt="Terms of Use"
                  onPress={() => navigate('TermsOfUseScreen')}
                  variant="link"
                  color="primary"
                  size="sm"
                  fullWidth={false}
                />
              </View>
            </>
          )}
        </Formik>
      </KeyboardAvoidingView>

      <ForgotPasswordModal
        visible={showForgotPassword}
        loading={resetLoading}
        onSubmit={async (email) => {
          const success = await resetPassword(email);
          if (success) setShowForgotPassword(false);
        }}
        onDismiss={() => setShowForgotPassword(false)}
      />
    </>
  );
}

export default memo(LoginScreen);

const makeStyles =(colors: AppColors)=> StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
     backgroundColor: colors.background, // ✅ add this
  },

  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },

  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadow.button,
  },

  micIcon: { alignItems: 'center' },
  micBody: { width: 18, height: 26, borderRadius: 9, backgroundColor: colors.white, marginBottom: 4 },
  micBase: { width: 28, height: 3, borderRadius: 2, backgroundColor: colors.white },
  micStand: { width: 3, height: 6, borderRadius: 2, backgroundColor: colors.white, marginTop: 1 },

  appName: {
    fontSize: 22,
    ...font.bold,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  tagline: {
    fontSize: 14,
    ...font.regular,
    color: colors.textMuted,
  },

  form: { gap: 12 },

  forgotPasswordBtn: { alignSelf: 'flex-end', marginTop: -4 },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },

  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.textMuted },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 36, 
  },

  footerText: { fontSize: 14, color: colors.textMuted },

  legalFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },

  legalSeparator: { color: colors.textMuted, marginHorizontal: 4 },
});
