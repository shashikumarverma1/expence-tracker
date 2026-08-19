import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import CText from '../../../core/component/CText';
import { AppColors } from '../../../core/utils';
import { useTheme } from '../../../core/hook';

export function PrivacyPolicyScreen() {
  return (
    <LegalScreen
      title="Privacy Policy"
      body="This is where your Privacy Policy content goes. Replace this placeholder text with your actual privacy policy."
    />
  );
}

export function TermsOfUseScreen() {
  return (
    <LegalScreen
      title="Terms of Use"
      body="This is where your Terms of Use content goes. Replace this placeholder text with your actual terms of use."
    />
  );
}

function LegalScreen({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <CText txt={title} size="lg" weight="semiBold" color={colors.text} />
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.content}>
        <CText txt={body} size="sm" color={colors.text} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  body:    { flex: 1 },
  content: { padding: 16 },
});
