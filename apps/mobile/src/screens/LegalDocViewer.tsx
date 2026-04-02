import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Legal Document Viewer - displays AI-generated charter/bylaws.
 *
 * Features:
 * - Markdown-rendered document with article navigation
 * - "Regenerate" button to try again with different params
 * - "Approve & Store on IPFS" button to finalize
 * - Disclaimer bar at top
 */

interface LegalDocViewerProps {
  document: string;
  communityName: string;
  template: string;
  jurisdiction: string;
  generationTimeMs: number;
  onApprove: () => void;
  onRegenerate: () => void;
  onBack: () => void;
  isStoring?: boolean;
}

export function LegalDocViewer({
  document,
  communityName,
  template,
  jurisdiction,
  generationTimeMs,
  onApprove,
  onRegenerate,
  onBack,
  isStoring = false,
}: LegalDocViewerProps) {
  const [showRaw, setShowRaw] = useState(false);

  // Simple markdown section extraction for navigation
  const articles = document
    .split('\n')
    .filter((line) => line.startsWith('## ') || line.startsWith('# '))
    .map((line) => line.replace(/^#+\s*/, ''));

  return (
    <SafeAreaView style={styles.container}>
      {/* Disclaimer banner */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerIcon}>AI</Text>
        <Text style={styles.disclaimerText}>
          AI-generated legal template. Review by qualified attorney recommended.
        </Text>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            Charter for {communityName}
          </Text>
          <Text style={styles.headerMeta}>
            {template} | {jurisdiction || 'No jurisdiction'} | Generated in{' '}
            {(generationTimeMs / 1000).toFixed(1)}s
          </Text>
        </View>
      </View>

      {/* Article quick-nav */}
      <ScrollView
        horizontal
        style={styles.articleNav}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.articleNavContent}
      >
        {articles.map((article, i) => (
          <TouchableOpacity key={i} style={styles.articleChip}>
            <Text style={styles.articleChipText} numberOfLines={1}>
              {article.length > 25 ? article.substring(0, 25) + '...' : article}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Document content */}
      <ScrollView style={styles.docScroll} contentContainerStyle={styles.docContent}>
        {document.split('\n').map((line, i) => {
          if (line.startsWith('# ')) {
            return (
              <Text key={i} style={styles.h1}>
                {line.replace('# ', '')}
              </Text>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <Text key={i} style={styles.h2}>
                {line.replace('## ', '')}
              </Text>
            );
          }
          if (line.startsWith('### ')) {
            return (
              <Text key={i} style={styles.h3}>
                {line.replace('### ', '')}
              </Text>
            );
          }
          if (line.startsWith('**') && line.endsWith('**')) {
            return (
              <Text key={i} style={styles.bold}>
                {line.replace(/\*\*/g, '')}
              </Text>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>  </Text>
                <Text style={styles.listText}>
                  {line.replace(/^[-*]\s/, '')}
                </Text>
              </View>
            );
          }
          if (line.trim() === '') {
            return <View key={i} style={styles.spacer} />;
          }
          return (
            <Text key={i} style={styles.paragraph}>
              {line}
            </Text>
          );
        })}
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.regenBtn} onPress={onRegenerate}>
          <Text style={styles.regenBtnText}>Regenerate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.approveBtn, isStoring && styles.approveBtnStoring]}
          onPress={onApprove}
          disabled={isStoring}
        >
          {isStoring ? (
            <ActivityIndicator color="#0D1117" size="small" />
          ) : (
            <Text style={styles.approveBtnText}>Approve</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D2200',
    padding: 8,
    gap: 8,
  },
  disclaimerIcon: {
    color: '#F0C040',
    fontWeight: '700',
    fontSize: 11,
    backgroundColor: '#F0C04033',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  disclaimerText: { color: '#F0C040', fontSize: 11, flex: 1 },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  headerTitle: { color: '#4ECDC4', fontSize: 18, fontWeight: '700' },
  headerMeta: { color: '#484F58', fontSize: 11, marginTop: 4 },
  articleNav: { maxHeight: 40, borderBottomWidth: 1, borderBottomColor: '#30363D' },
  articleNavContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  articleChip: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  articleChipText: { color: '#8B949E', fontSize: 10 },
  docScroll: { flex: 1 },
  docContent: { padding: 16, paddingBottom: 100 },
  h1: {
    color: '#4ECDC4',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  h2: {
    color: '#E6EDF3',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    paddingBottom: 6,
  },
  h3: {
    color: '#C9D1D9',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  bold: { color: '#E6EDF3', fontSize: 13, fontWeight: '700', marginVertical: 4 },
  paragraph: { color: '#C9D1D9', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  listItem: { flexDirection: 'row', marginBottom: 2, paddingLeft: 8 },
  bullet: { color: '#4ECDC4', fontSize: 13 },
  listText: { color: '#C9D1D9', fontSize: 13, lineHeight: 20, flex: 1 },
  spacer: { height: 8 },
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    backgroundColor: '#0D1117',
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  backBtnText: { color: '#8B949E', fontSize: 14 },
  regenBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7B68EE',
  },
  regenBtnText: { color: '#7B68EE', fontSize: 14, fontWeight: '600' },
  approveBtn: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveBtnStoring: { backgroundColor: '#3BA89F' },
  approveBtnText: { color: '#0D1117', fontSize: 14, fontWeight: '700' },
});
