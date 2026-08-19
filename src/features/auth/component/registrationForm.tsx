import React, { memo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';

import { Formik } from 'formik'; 
import * as Yup from 'yup'; 
import { useAuthHook } from '../hooks';
import { CButton, CTextInput, CLoading, Logo } from '../../../core/component';

import { useTheme } from '../../../core/hook';
import CText from '../../../core/component/CText'; 
import { AppColors, font, shadow } from '../../../core/utils';

const registerSchema = Yup.object().shape({
  name: Yup.string().required('name-required'),
  email: Yup.string().email('email-invalid').required('email-required'),
  password: Yup.string().min(6, 'password-min').required('password-required'),
  cpassword: Yup.string()
    .oneOf([Yup.ref('password')], 'cpassword-match')
    .required('cpassword-required'),
});

function RegisterScreen({ onToggle }: { onToggle: () => void }) {
  const { mode, colors, toggleTheme } = useTheme();
  const styles = makeStyles(colors);
  const { register, loading } = useAuthHook();

  return (
    <>
      <CLoading visible={loading} variant="compact" message="Creating account…" />
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
               <Logo w={150} h={150} r={100}/>
        </View>
        <Formik
          initialValues={{ name: '', email: '', password: '', cpassword: '' }}
          validationSchema={registerSchema}
          onSubmit={(values) => {
            // console.log(values);
            register(values)
            // TODO: call Register hook
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, handleSubmit, submitCount }) => (
            <>
              <View style={styles.form}>
                <CTextInput
                  label="fname"
                  status={(touched.name || submitCount > 0) && errors.name ? 'error' : undefined}
                  errorMessage={(touched.name || submitCount > 0) && errors.name ? errors.name : undefined}
                  ptx="auth.enter_name"
                  value={values.name}
                  onChangeText={handleChange('name')}
                  onBlur={handleBlur('name')}
                  autoCapitalize="words"
                />

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

                <CTextInput
                  label="cpassword"
                  ptx="auth.confirm_password"
                  value={values.cpassword}
                  onChangeText={handleChange('cpassword')}
                  onBlur={handleBlur('cpassword')}
                  isPassword
                  status={(touched.cpassword || submitCount > 0) && errors.cpassword ? 'error' : undefined}
                  errorMessage={(touched.cpassword || submitCount > 0) && errors.cpassword ? errors.cpassword : undefined}
                />

                <CButton
                  tx="register"
                  onPress={handleSubmit}
                  color="primary"
                  size="md"
                />
              </View>

              <View style={styles.footer}>
                <CText style={styles.footerText}  tx='already-have-account'/>
                <CButton
                  tx="login"
                  onPress={onToggle}
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
    </>
  );
}

export default memo(RegisterScreen);

const makeStyles = (colors: AppColors) => StyleSheet.create({
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

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 36,
  },

  footerText: { fontSize: 14, color: colors.textMuted },
});
