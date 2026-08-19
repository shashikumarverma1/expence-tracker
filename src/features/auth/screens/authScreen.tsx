import React, { memo, useCallback, useState } from 'react';
import { StatusBar } from 'react-native';
import LoginScreen from '../component/loginForm';
import RegisterScreen from '../component/registrationForm';

export function AuthScreen({ onLogin }: { onLogin?: () => void }) {
  const [isLogin, setIsLogin] = useState(true);

  const onToggle = useCallback(() => {
    setIsLogin((prev) => !prev);
  }, []);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      {isLogin
        ? <LoginScreen onToggle={onToggle} />
        : <RegisterScreen onToggle={onToggle} />}
    </>
  );
}

export default memo(AuthScreen);
