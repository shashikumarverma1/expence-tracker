import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import LogoImage from '../../../assets/logo.png';

interface Props {
  w: number;
  h: number;
  r?: number;
  style?: StyleProp<ImageStyle>;
}

export const Logo = ({ w, h, r = 0, style }: Props) => (
  <Image source={LogoImage} style={[{ width: w, height: h, borderRadius: r }, style]} resizeMode="contain" />
);
