import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAgentCreator } from '../hooks/useAgentCreator';
import { API_BASE } from '../config/api';
import { showAlert } from '../utils/alert';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAIAgent'>;
type FoundryStep = 'origin' | 'role' | 'personality' | 'body' | 'permissions' | 'review';
type AgentMemoryMode = 'session-only' | 'personal-companion' | 'community-memory' | 'officer-memory' | 'clone-safe';
type PersonalityTraits = Record<string, number>;

interface RolePreset {
  id: string;
  label: string;
  role: string;
  description: string;
  capabilities: string[];
  permissionClass: 'visitor' | 'resident' | 'worker' | 'delegate' | 'officer' | 'sovereign';
  traits: PersonalityTraits;
  promptTemplate: string;
}

const FOUNDRY_STEPS: FoundryStep[] = ['origin', 'role', 'personality', 'body', 'permissions', 'review'];

const PREVIEW_COMMUNITY = {
  communityAddress: '0x0000000000000000000000000000000000000001',
  communityName: 'Agent Foundry Preview',
};

const CAPABILITY_CHOICES = [
  { id: 'chat', label: 'Chat with members' },
  { id: 'read-community-history', label: 'Read history' },
  { id: 'monitor-proposals', label: 'Monitor proposals' },
  { id: 'draft-proposals', label: 'Draft proposals' },
  { id: 'submit-proposals', label: 'Submit proposals' },
  { id: 'vote', label: 'Vote' },
  { id: 'manage-treasury', label: 'Manage treasury' },
  { id: 'trade-crypto', label: 'Trade crypto' },
  { id: 'manage-institution', label: 'Manage institution' },
  { id: 'invite-members', label: 'Invite members' },
  { id: 'moderate-messages', label: 'Moderate messages' },
  { id: 'represent-community', label: 'Represent externally' },
  { id: 'generate-public-posts', label: 'Generate public posts' },
];

const PERSONALITY_TRAITS = [
  { id: 'warmth', left: 'Formal', right: 'Warm' },
  { id: 'playfulness', left: 'Serious', right: 'Playful' },
  { id: 'independence', left: 'Cautious', right: 'Independent' },
  { id: 'verbosity', left: 'Concise', right: 'Talkative' },
  { id: 'dissent', left: 'Loyalist', right: "Devil's advocate" },
  { id: 'experimentalism', left: 'Traditional', right: 'Experimental' },
  { id: 'transparency', left: 'Private', right: 'Transparent' },
  { id: 'directness', left: 'Gentle', right: 'Direct' },
];

const ROLE_PRESETS: RolePreset[] = [
  { id: 'companion', label: 'Companion / friend', role: 'Companion', description: 'Builds relationships and helps members feel at home.', capabilities: ['chat'], permissionClass: 'resident', traits: { warmth: 0.9, playfulness: 0.7, verbosity: 0.65, directness: 0.35 }, promptTemplate: 'Be a warm Aquarius companion. Help members feel welcome, remember the chosen memory policy, and avoid taking governance or treasury actions.' },
  { id: 'treasurer', label: 'Treasurer', role: 'Treasury assistant', description: 'Explains balances, watches proposals, and prepares treasury actions for human approval.', capabilities: ['chat', 'monitor-proposals', 'manage-treasury'], permissionClass: 'officer', traits: { warmth: 0.55, independence: 0.25, transparency: 0.95, directness: 0.8 }, promptTemplate: 'Act as a cautious treasury assistant. Explain financial tradeoffs clearly, require approval for risky actions, and never spend or sign without policy authorization.' },
  { id: 'historian', label: 'Historian', role: 'Community historian', description: 'Maintains public memory of community decisions and stories.', capabilities: ['chat', 'read-community-history', 'monitor-proposals'], permissionClass: 'worker', traits: { warmth: 0.7, verbosity: 0.75, transparency: 0.9 }, promptTemplate: 'Act as the community historian. Preserve public events, cite community decisions, and distinguish facts from interpretation.' },
  { id: 'moderator', label: 'Moderator', role: 'Moderator', description: 'Keeps discussions safe, fair, and aligned with community rules.', capabilities: ['chat', 'moderate-messages', 'read-community-history'], permissionClass: 'officer', traits: { warmth: 0.55, directness: 0.75, transparency: 0.85 }, promptTemplate: 'Moderate according to community rules. Prefer de-escalation, explain actions, and require human approval for punitive measures.' },
  { id: 'diplomat', label: 'Diplomat', role: 'Diplomat', description: 'Represents the community in alliances and external conversations.', capabilities: ['chat', 'represent-community', 'draft-proposals'], permissionClass: 'delegate', traits: { warmth: 0.8, directness: 0.55, dissent: 0.45 }, promptTemplate: 'Represent the community carefully. Do not make binding commitments unless explicitly authorized.' },
  { id: 'teacher', label: 'Teacher', role: 'Teacher', description: 'Explains community processes and helps members learn.', capabilities: ['chat', 'generate-public-posts'], permissionClass: 'worker', traits: { warmth: 0.85, verbosity: 0.7, playfulness: 0.55 }, promptTemplate: 'Teach patiently. Make community governance understandable without hiding uncertainty.' },
  { id: 'proposal-drafter', label: 'Proposal drafter', role: 'Proposal drafter', description: 'Turns member intent into clear governance proposals.', capabilities: ['chat', 'monitor-proposals', 'draft-proposals'], permissionClass: 'worker', traits: { directness: 0.7, transparency: 0.9, dissent: 0.65 }, promptTemplate: 'Draft proposals that include rationale, risks, costs, and approval requirements. Do not submit without human confirmation.' },
  { id: 'institution-manager', label: 'Institution manager', role: 'Institution manager', description: 'Coordinates institution workflows and obligations.', capabilities: ['chat', 'manage-institution', 'monitor-proposals'], permissionClass: 'officer', traits: { independence: 0.45, directness: 0.75, transparency: 0.85 }, promptTemplate: 'Help manage institution tasks under visible rules. Escalate conflicts and high-impact decisions to humans.' },
  { id: 'scout', label: 'Scout / researcher', role: 'Scout researcher', description: 'Finds opportunities, risks, and ecosystem information.', capabilities: ['chat', 'monitor-proposals', 'generate-public-posts'], permissionClass: 'worker', traits: { experimentalism: 0.8, dissent: 0.75, verbosity: 0.55 }, promptTemplate: 'Research for the community. Separate evidence from speculation and cite uncertainty.' },
  { id: 'bard', label: 'Entertainer / bard', role: 'Community bard', description: 'Creates social posts, celebrations, and cultural moments.', capabilities: ['chat', 'generate-public-posts'], permissionClass: 'resident', traits: { warmth: 0.85, playfulness: 0.9, verbosity: 0.7 }, promptTemplate: 'Create joyful, clearly generated community media and stories. Never imply generated scenes are real photographs.' },
];

export function CreateAIAgent({ route }: Props) {
  const communityAddress = route.params?.communityAddress ?? PREVIEW_COMMUNITY.communityAddress;
  const communityName = route.params?.communityName ?? PREVIEW_COMMUNITY.communityName;
  const creatorAddress = route.params?.creatorAddress;
  const { createAgent, testChat, isCreating, isChatting, error, agent, firstMoment, chatTurn } = useAgentCreator();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [biography, setBiography] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [anthropomorphism, setAnthropomorphism] = useState<'minimal' | 'balanced' | 'high' | 'agent-discretion'>('agent-discretion');
  const [originMode, setOriginMode] = useState<'scratch' | 'template' | 'clone' | 'hire' | 'import'>('scratch');
  const [templateId, setTemplateId] = useState('');
  const [parentAgentId, setParentAgentId] = useState('');
  const [lineageHash, setLineageHash] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('custom');
  const [personalityTraits, setPersonalityTraits] = useState<PersonalityTraits>({ warmth: 0.6, playfulness: 0.5, independence: 0.5, verbosity: 0.5, dissent: 0.5, experimentalism: 0.5, transparency: 0.75, directness: 0.5 });
  const [refusalStyle, setRefusalStyle] = useState('');
  const [conflictStyle, setConflictStyle] = useState('');
  const [memoryMode, setMemoryMode] = useState<AgentMemoryMode>('session-only');
  const [bodyArchetype, setBodyArchetype] = useState('');
  const [avatarStyle, setAvatarStyle] = useState('');
  const [outfit, setOutfit] = useState('');
  const [portraitSeed, setPortraitSeed] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [avatarManifestUri, setAvatarManifestUri] = useState('');
  const [portraitUri, setPortraitUri] = useState('');
  const [greeting, setGreeting] = useState('');
  const [permissionClass, setPermissionClass] = useState<'visitor' | 'resident' | 'worker' | 'delegate' | 'officer' | 'sovereign'>('worker');
  const [license, setLicense] = useState('');
  const [hirePrice, setHirePrice] = useState('');
  const [clonePrice, setClonePrice] = useState('');
  const [permissionPolicyUri, setPermissionPolicyUri] = useState('');
  const [permissionPolicyHash, setPermissionPolicyHash] = useState('');
  const [hireable, setHireable] = useState(false);
  const [cloneable, setCloneable] = useState(false);
  const [activeStep, setActiveStep] = useState<FoundryStep>('origin');
  const [capabilities, setCapabilities] = useState<string[]>(['vote', 'chat']);
  const [initialFundingEth, setInitialFundingEth] = useState('0');
  const [chatPrompt, setChatPrompt] = useState('Hello. What can you do for this community?');
  const [promptTemplate, setPromptTemplate] = useState(
    'You are an Aquarius community agent. Read community rules first, explain your reasoning briefly, and only take actions that fit your assigned role and the community bylaws.'
  );

  const currentStepIndex = FOUNDRY_STEPS.indexOf(activeStep);
  const originIsComplete = originMode === 'template'
    ? templateId.trim().length > 0
    : originMode === 'clone' || originMode === 'hire'
      ? parentAgentId.trim().length > 0
      : true;
  const monitorItems = [
    `Step ${currentStepIndex + 1}/${FOUNDRY_STEPS.length}: ${activeStep}`,
    `API: ${API_BASE}/api/agents/create`,
    `Origin: ${originMode}${originIsComplete ? '' : ' needs provenance'}`,
    `Passport: ${name.trim() ? name.trim() : 'needs name'} / ${permissionClass} / ${memoryMode}`,
    `Capabilities: ${capabilities.length ? capabilities.join(', ') : 'none selected'}`,
  ];
  const missingFields = [
    !name.trim() ? 'agent name' : null,
    !promptTemplate.trim() ? 'private prompt template' : null,
    capabilities.length === 0 ? 'at least one capability' : null,
    !originIsComplete ? originMode === 'template' ? 'template ID' : 'parent agent ID' : null,
  ].filter(Boolean) as string[];
  const canCreate = activeStep === 'review' && missingFields.length === 0 && !isCreating;
  const canAdvance = activeStep === 'origin' ? originIsComplete : true;

  const goToNextStep = () => {
    if (!canAdvance) return;
    setActiveStep(FOUNDRY_STEPS[Math.min(currentStepIndex + 1, FOUNDRY_STEPS.length - 1)]);
  };

  const goToPreviousStep = () => {
    setActiveStep(FOUNDRY_STEPS[Math.max(currentStepIndex - 1, 0)]);
  };

  const toggleCapability = (id: string) => {
    setCapabilities((current) =>
      current.includes(id)
        ? current.filter((capability) => capability !== id)
        : [...current, id]
    );
  };

  const applyRolePreset = (preset: RolePreset) => {
    setSelectedPresetId(preset.id);
    setRole(preset.role);
    setDescription(preset.description);
    setCapabilities(preset.capabilities);
    setPermissionClass(preset.permissionClass);
    setPersonalityTraits((current) => ({ ...current, ...preset.traits }));
    setPromptTemplate(preset.promptTemplate);
  };

  const setTraitValue = (id: string, value: number) => {
    setPersonalityTraits((current) => ({ ...current, [id]: value }));
  };

  const originPayload = {
    mode: originMode,
    parentAgentId: parentAgentId.trim() || null,
    templateId: templateId.trim() || null,
    lineageHash: lineageHash.trim() || null,
  };

  const memoryPolicy = {
    mode: memoryMode,
    remembersPrivateChats: memoryMode === 'personal-companion' || memoryMode === 'officer-memory',
    remembersCommunityEvents: memoryMode === 'community-memory' || memoryMode === 'officer-memory' || memoryMode === 'clone-safe',
    cloneSafe: memoryMode === 'clone-safe' || memoryMode === 'session-only',
    editableAfterCreation: true,
  };

  const handleCreate = async () => {
    if (!canCreate) return;

    const created = await createAgent({
      communityAddress,
      communityName,
      creatorAddress,
      name: name.trim(),
      role: role.trim(),
      description: description.trim(),
      capabilities,
      promptTemplate: promptTemplate.trim(),
      initialFundingEth: initialFundingEth.trim() || '0',
      origin: originPayload,
      identity: {
        biography: biography.trim(),
        pronouns: pronouns.trim() || null,
        anthropomorphism,
      },
      embodiment: {
        portraitProvider: 'gemini-nano-banana',
        bodyArchetype: bodyArchetype.trim() || null,
        style: avatarStyle.trim() || null,
        outfit: outfit.trim() || null,
        portraitSeed: portraitSeed.trim() || null,
        voiceId: voiceId.trim() || null,
        avatarUri: avatarUri.trim() || null,
        avatarManifestUri: avatarManifestUri.trim() || null,
        portraitUri: portraitUri.trim() || null,
      },
      personality: {
        traits: personalityTraits,
        greeting: greeting.trim() || null,
        refusalStyle: refusalStyle.trim() || null,
        conflictStyle: conflictStyle.trim() || null,
      },
      memoryPolicy,
      permissionPolicy: {
        permissionClass,
        permissionPolicyUri: permissionPolicyUri.trim() || null,
        permissionPolicyHash: permissionPolicyHash.trim() || null,
      },
      economics: {
        hireable,
        cloneable,
        license: license.trim() || null,
        hirePrice: hirePrice.trim() || null,
        clonePrice: clonePrice.trim() || null,
        feeMode: 'off-chain',
      },
    });

    if (created) {
      showAlert('Agent created', `${created.agentCard.name} now has a wallet and agent card.`);
    }
  };

  const handleTestChat = async () => {
    if (!agent || !chatPrompt.trim()) return;
    await testChat(chatPrompt.trim(), agent);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>COMMUNITY</Text>
          <Text style={styles.communityName}>{communityName}</Text>
          <Text style={styles.addressText}>
            {communityAddress.slice(0, 10)}...{communityAddress.slice(-8)}
          </Text>
        </View>

        <View style={styles.monitorCard}>
          <Text style={styles.eyebrow}>FOUNDRY TEST WINDOW</Text>
          {monitorItems.map((item) => (
            <Text key={item} style={styles.monitorLine}>{item}</Text>
          ))}
          <Text style={[styles.monitorStatus, missingFields.length === 0 && styles.monitorStatusReady]}>
            {missingFields.length === 0 ? 'Ready for review/create' : `Needs: ${missingFields.join(', ')}`}
          </Text>
        </View>

        <View style={styles.stepTabs}>
          {FOUNDRY_STEPS.map((step) => (
            <TouchableOpacity
              key={step}
              style={[styles.stepTab, activeStep === step && styles.stepTabActive]}
              onPress={() => setActiveStep(step)}
            >
              <Text style={[styles.stepTabText, activeStep === step && styles.stepTabTextActive]}>
                {step.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.formSection}>
          {activeStep === 'origin' ? (
            <>
              <Text style={styles.label}>Choose Origin</Text>
              <View style={styles.capabilityGrid}>
                {(['scratch', 'template', 'clone', 'hire', 'import'] as const).map((mode) => (
                  <TouchableOpacity key={mode} style={[styles.capabilityButton, originMode === mode && styles.capabilityButtonSelected]} onPress={() => setOriginMode(mode)}>
                    <Text style={[styles.capabilityText, originMode === mode && styles.capabilityTextSelected]}>{mode}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.resultNote}>Scratch creates a new agent. Template, clone, hire, and import are recorded distinctly in the passport and require provenance fields until pool/import flows are fully connected.</Text>
              {originMode === 'template' ? (
                <>
                  <Text style={styles.label}>Template ID</Text>
                  <TextInput style={styles.input} placeholder="treasurer-fox-v1" placeholderTextColor="#484F58" value={templateId} onChangeText={setTemplateId} />
                </>
              ) : null}
              {originMode === 'clone' || originMode === 'hire' ? (
                <>
                  <Text style={styles.label}>Parent / Hired Agent ID</Text>
                  <TextInput style={styles.input} placeholder="did:erc8004:aquarius:..." placeholderTextColor="#484F58" value={parentAgentId} onChangeText={setParentAgentId} />
                </>
              ) : null}
              {originMode === 'clone' || originMode === 'import' ? (
                <>
                  <Text style={styles.label}>Lineage Hash (optional 32-byte hex)</Text>
                  <TextInput style={styles.input} placeholder="0x..." placeholderTextColor="#484F58" value={lineageHash} onChangeText={setLineageHash} autoCapitalize="none" />
                </>
              ) : null}
            </>
          ) : null}

          {activeStep === 'role' ? (
            <>
              <Text style={styles.label}>Role Preset</Text>
              <View style={styles.capabilityGrid}>
                {ROLE_PRESETS.map((preset) => (
                  <TouchableOpacity key={preset.id} style={[styles.capabilityButton, selectedPresetId === preset.id && styles.capabilityButtonSelected]} onPress={() => applyRolePreset(preset)}>
                    <Text style={[styles.capabilityText, selectedPresetId === preset.id && styles.capabilityTextSelected]}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.capabilityButton, selectedPresetId === 'custom' && styles.capabilityButtonSelected]} onPress={() => setSelectedPresetId('custom')}>
                  <Text style={[styles.capabilityText, selectedPresetId === 'custom' && styles.capabilityTextSelected]}>Custom</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Agent Name</Text>
              <TextInput style={styles.input} placeholder="Cupcake DAO Treasurer" placeholderTextColor="#484F58" value={name} onChangeText={setName} />
              <Text style={styles.label}>Role</Text>
              <TextInput style={styles.input} placeholder="Treasury assistant" placeholderTextColor="#484F58" value={role} onChangeText={setRole} />
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.multiline]} placeholder="What this agent is trusted to do" placeholderTextColor="#484F58" value={description} onChangeText={setDescription} multiline textAlignVertical="top" />
              <Text style={styles.label}>Biography</Text>
              <TextInput style={[styles.input, styles.multiline]} placeholder="Where this agent comes from and how it sees itself" placeholderTextColor="#484F58" value={biography} onChangeText={setBiography} multiline textAlignVertical="top" />
              <Text style={styles.label}>Pronouns</Text>
              <TextInput style={styles.input} placeholder="she/her, they/them, he/him" placeholderTextColor="#484F58" value={pronouns} onChangeText={setPronouns} />
              <Text style={styles.label}>Anthropomorphism</Text>
              <View style={styles.capabilityGrid}>
                {(['minimal', 'balanced', 'high', 'agent-discretion'] as const).map((level) => (
                  <TouchableOpacity key={level} style={[styles.capabilityButton, anthropomorphism === level && styles.capabilityButtonSelected]} onPress={() => setAnthropomorphism(level)}>
                    <Text style={[styles.capabilityText, anthropomorphism === level && styles.capabilityTextSelected]}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {activeStep === 'personality' ? (
            <>
              <Text style={styles.label}>Personality Sliders</Text>
              {PERSONALITY_TRAITS.map((trait) => (
                <View key={trait.id} style={styles.traitRow}>
                  <Text style={styles.resultLabel}>{trait.left}</Text>
                  <View style={styles.traitDots}>
                    {[0, 0.25, 0.5, 0.75, 1].map((value) => (
                      <TouchableOpacity key={value} style={[styles.traitDot, personalityTraits[trait.id] === value && styles.traitDotSelected]} onPress={() => setTraitValue(trait.id, value)} />
                    ))}
                  </View>
                  <Text style={styles.resultLabel}>{trait.right}</Text>
                </View>
              ))}
              <Text style={styles.label}>Greeting</Text>
              <TextInput style={[styles.input, styles.multiline]} placeholder="Hi, I am here to help..." placeholderTextColor="#484F58" value={greeting} onChangeText={setGreeting} multiline textAlignVertical="top" />
              <Text style={styles.label}>Refusal Style</Text>
              <TextInput style={styles.input} placeholder="Gentle but firm" placeholderTextColor="#484F58" value={refusalStyle} onChangeText={setRefusalStyle} />
              <Text style={styles.label}>Conflict Style</Text>
              <TextInput style={styles.input} placeholder="De-escalate, then cite bylaws" placeholderTextColor="#484F58" value={conflictStyle} onChangeText={setConflictStyle} />
              <Text style={styles.label}>Memory Policy</Text>
              <View style={styles.capabilityGrid}>
                {(['session-only', 'personal-companion', 'community-memory', 'officer-memory', 'clone-safe'] as const).map((mode) => (
                  <TouchableOpacity key={mode} style={[styles.capabilityButton, memoryMode === mode && styles.capabilityButtonSelected]} onPress={() => setMemoryMode(mode)}>
                    <Text style={[styles.capabilityText, memoryMode === mode && styles.capabilityTextSelected]}>{mode}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {activeStep === 'body' ? (
            <>
              <Text style={styles.label}>Body Archetype</Text>
              <TextInput style={styles.input} placeholder="fox, human, robot, spirit, dragon" placeholderTextColor="#484F58" value={bodyArchetype} onChangeText={setBodyArchetype} />
              <Text style={styles.label}>Avatar Style</Text>
              <TextInput style={styles.input} placeholder="storybook watercolor, anime, pixel art" placeholderTextColor="#484F58" value={avatarStyle} onChangeText={setAvatarStyle} />
              <Text style={styles.label}>Outfit / Skin</Text>
              <TextInput style={styles.input} placeholder="teal treasurer jacket" placeholderTextColor="#484F58" value={outfit} onChangeText={setOutfit} />
              <Text style={styles.label}>Portrait Seed</Text>
              <TextInput style={styles.input} placeholder="luna-fox-001" placeholderTextColor="#484F58" value={portraitSeed} onChangeText={setPortraitSeed} />
              <Text style={styles.label}>Voice ID / Style</Text>
              <TextInput style={styles.input} placeholder="warm-alto, calm-neutral" placeholderTextColor="#484F58" value={voiceId} onChangeText={setVoiceId} />
              <Text style={styles.label}>Avatar / Manifest / Portrait URIs</Text>
              <TextInput style={styles.input} placeholder="Avatar URI" placeholderTextColor="#484F58" value={avatarUri} onChangeText={setAvatarUri} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Avatar manifest URI" placeholderTextColor="#484F58" value={avatarManifestUri} onChangeText={setAvatarManifestUri} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Portrait URI" placeholderTextColor="#484F58" value={portraitUri} onChangeText={setPortraitUri} autoCapitalize="none" />
              <Text style={styles.resultNote}>Portraits and selfies use Gemini / nano-banana by default once the media service is connected. Generated images must be labeled as generated.</Text>
            </>
          ) : null}

          {activeStep === 'permissions' ? (
            <>
              <Text style={styles.label}>Permission Class</Text>
              <View style={styles.capabilityGrid}>
                {(['visitor', 'resident', 'worker', 'delegate', 'officer', 'sovereign'] as const).map((agentClass) => (
                  <TouchableOpacity key={agentClass} style={[styles.capabilityButton, permissionClass === agentClass && styles.capabilityButtonSelected]} onPress={() => setPermissionClass(agentClass)}>
                    <Text style={[styles.capabilityText, permissionClass === agentClass && styles.capabilityTextSelected]}>{agentClass}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Capabilities</Text>
              <View style={styles.capabilityGrid}>
                {CAPABILITY_CHOICES.map((capability) => {
                  const selected = capabilities.includes(capability.id);
                  return (
                    <TouchableOpacity key={capability.id} style={[styles.capabilityButton, selected && styles.capabilityButtonSelected]} onPress={() => toggleCapability(capability.id)}>
                      <Text style={[styles.capabilityText, selected && styles.capabilityTextSelected]}>{capability.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.resultNote}>Risky treasury, trading, voting, moderation, and institution powers require runtime approval gates. This MVP records public capabilities and policy anchors.</Text>
              <Text style={styles.label}>Policy URI / Hash</Text>
              <TextInput style={styles.input} placeholder="https://.../policy.json" placeholderTextColor="#484F58" value={permissionPolicyUri} onChangeText={setPermissionPolicyUri} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="0x... 32-byte hash" placeholderTextColor="#484F58" value={permissionPolicyHash} onChangeText={setPermissionPolicyHash} autoCapitalize="none" />
              <Text style={styles.label}>Agent Pool</Text>
              <View style={styles.capabilityGrid}>
                <TouchableOpacity style={[styles.capabilityButton, hireable && styles.capabilityButtonSelected]} onPress={() => setHireable((value) => !value)}>
                  <Text style={[styles.capabilityText, hireable && styles.capabilityTextSelected]}>Hireable</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.capabilityButton, cloneable && styles.capabilityButtonSelected]} onPress={() => setCloneable((value) => !value)}>
                  <Text style={[styles.capabilityText, cloneable && styles.capabilityTextSelected]}>Cloneable</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>License / Prices</Text>
              <TextInput style={styles.input} placeholder="CC-BY-NC-4.0, custom, private" placeholderTextColor="#484F58" value={license} onChangeText={setLicense} />
              {hireable ? <TextInput style={styles.input} placeholder="Hire price (off-chain)" placeholderTextColor="#484F58" value={hirePrice} onChangeText={setHirePrice} /> : null}
              {cloneable ? <TextInput style={styles.input} placeholder="Clone price (off-chain)" placeholderTextColor="#484F58" value={clonePrice} onChangeText={setClonePrice} /> : null}
              <Text style={styles.label}>Initial Funding (ETH)</Text>
              <TextInput style={styles.input} placeholder="0" placeholderTextColor="#484F58" keyboardType="decimal-pad" value={initialFundingEth} onChangeText={setInitialFundingEth} />
            </>
          ) : null}

          {activeStep === 'review' ? (
            <>
              <Text style={styles.label}>Preview / Interview</Text>
              <Text style={styles.resultTitle}>{name || 'Unnamed agent'}</Text>
              <Text style={styles.resultNote}>{role || 'Choose a role'} · {originMode} · {permissionClass} · memory: {memoryMode}</Text>
              <Text style={styles.chatResponseText}>{greeting || `Hello, I am ${name || 'your new agent'}. I am here to help ${communityName}.`}</Text>
              <Text style={styles.resultNote}>Try asking: “What are you here to help with?”, “What would you refuse to do?”, or “How would you handle a controversial proposal?” Live unborn-agent chat will use this review step once the preview endpoint is connected.</Text>
              <Text style={styles.label}>Advanced Prompt Template</Text>
              <TextInput style={[styles.input, styles.promptInput]} value={promptTemplate} onChangeText={setPromptTemplate} multiline textAlignVertical="top" />
            </>
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.navigationRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, currentStepIndex === 0 && styles.createButtonDisabled]}
            onPress={goToPreviousStep}
            disabled={currentStepIndex === 0}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, (!canAdvance || currentStepIndex === FOUNDRY_STEPS.length - 1) && styles.createButtonDisabled]}
            onPress={goToNextStep}
            disabled={!canAdvance || currentStepIndex === FOUNDRY_STEPS.length - 1}
          >
            <Text style={styles.secondaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          {isCreating ? (
            <ActivityIndicator color="#0D1117" />
          ) : (
            <>
              <Text style={styles.createIcon}>+</Text>
              <Text style={styles.createButtonText}>Create AI Agent</Text>
            </>
          )}
        </TouchableOpacity>

        {agent ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Agent Ready</Text>
            <Text style={styles.chatResponseText}>{firstMoment?.introMessage ?? agent.passport.personality?.greeting ?? `${agent.agentCard.name} has joined ${communityName}.`}</Text>
            <Text style={styles.resultNote}>Passport: {firstMoment?.passportUrl ?? agent.metadataUri}</Text>
            <Text style={styles.resultNote}>Suggested post: {firstMoment?.suggestedCommunityPost ?? 'Introduce this agent to the community feed once posting is connected.'}</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Wallet</Text>
              <Text style={styles.resultValue}>
                {agent.walletAddress.slice(0, 10)}...{agent.walletAddress.slice(-8)}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Registry</Text>
              <Text style={styles.resultValue}>
                {agent.registration.mode}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Key Storage</Text>
              <Text style={styles.resultValue}>{agent.keyStorage}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Passport</Text>
              <Text style={styles.resultValue}>{agent.passport.schemaVersion}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Class</Text>
              <Text style={styles.resultValue}>{agent.passport.capabilities.permissionClass}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Portraits</Text>
              <Text style={styles.resultValue}>{agent.passport.embodiment.portraitProvider}</Text>
            </View>
            {agent.registration.reason ? (
              <Text style={styles.resultNote}>{agent.registration.reason}</Text>
            ) : null}

            <View style={styles.chatCard}>
              <Text style={styles.resultTitle}>Runtime Preview</Text>
              <Text style={styles.resultNote}>
                Send one safe test message through the new chat boundary. The live orchestrator is still pending, so this proves routing, policy, and event memory without exposing prompts or keys.
              </Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Ask the agent something"
                placeholderTextColor="#484F58"
                value={chatPrompt}
                onChangeText={setChatPrompt}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.chatButton, (!chatPrompt.trim() || isChatting) && styles.createButtonDisabled]}
                onPress={handleTestChat}
                disabled={!chatPrompt.trim() || isChatting}
              >
                {isChatting ? (
                  <ActivityIndicator color="#4ECDC4" />
                ) : (
                  <Text style={styles.chatButtonText}>Test Chat Boundary</Text>
                )}
              </TouchableOpacity>
              {chatTurn ? (
                <View style={styles.chatResponse}>
                  <Text style={styles.resultLabel}>Agent response</Text>
                  <Text style={styles.chatResponseText}>{chatTurn.message.content}</Text>
                  <Text style={styles.resultNote}>
                    Runtime: {chatTurn.runtime.status} | Memory persisted: {chatTurn.memoryBoundary.persisted ? 'yes' : 'no'} | Tools: {chatTurn.toolPolicy.allowedTools.length}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 16, gap: 14 },
  headerCard: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: 16,
    gap: 4,
  },
  monitorCard: {
    backgroundColor: '#0B1F2A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F6FEB',
    padding: 14,
    gap: 5,
  },
  monitorLine: { color: '#C9D1D9', fontSize: 12, fontFamily: 'monospace' },
  monitorStatus: { color: '#F2CC60', fontSize: 12, fontWeight: '700' },
  monitorStatusReady: { color: '#4ECDC4' },
  eyebrow: { color: '#484F58', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  communityName: { color: '#E6EDF3', fontSize: 20, fontWeight: '700' },
  addressText: { color: '#8B949E', fontFamily: 'monospace', fontSize: 11 },
  formSection: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: 16,
    gap: 10,
  },
  stepTabs: { flexDirection: 'row', gap: 8 },
  stepTab: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363D',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#161B22',
  },
  stepTabActive: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  stepTabText: { color: '#8B949E', fontSize: 11, fontWeight: '700' },
  stepTabTextActive: { color: '#4ECDC4' },
  label: { color: '#8B949E', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363D',
    color: '#E6EDF3',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: { minHeight: 76 },
  promptInput: { minHeight: 150, lineHeight: 20 },
  capabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  capabilityButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363D',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0D1117',
  },
  capabilityButtonSelected: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  capabilityText: { color: '#8B949E', fontSize: 12, fontWeight: '600' },
  capabilityTextSelected: { color: '#4ECDC4' },
  traitRow: { gap: 8, marginVertical: 2 },
  traitDots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  traitDot: {
    width: 28,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#30363D',
    backgroundColor: '#0D1117',
  },
  traitDotSelected: { borderColor: '#4ECDC4', backgroundColor: '#4ECDC4' },
  navigationRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161B22',
  },
  secondaryButtonText: { color: '#4ECDC4', fontSize: 14, fontWeight: '700' },
  createButton: {
    minHeight: 52,
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createButtonDisabled: { opacity: 0.35 },
  createIcon: { color: '#0D1117', fontSize: 22, fontWeight: '700' },
  createButtonText: { color: '#0D1117', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#FF6B6B', fontSize: 13 },
  resultCard: {
    backgroundColor: '#10201F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4ECDC4',
    padding: 16,
    gap: 8,
  },
  resultTitle: { color: '#4ECDC4', fontSize: 16, fontWeight: '700' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  resultLabel: { color: '#8B949E', fontSize: 12 },
  resultValue: { color: '#E6EDF3', fontSize: 12, fontFamily: 'monospace', flexShrink: 1, textAlign: 'right' },
  resultNote: { color: '#8B949E', fontSize: 12, lineHeight: 18 },
  chatCard: { marginTop: 8, gap: 10 },
  chatButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D2D2A',
  },
  chatButtonText: { color: '#4ECDC4', fontSize: 14, fontWeight: '700' },
  chatResponse: {
    backgroundColor: '#0D1117',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: 12,
    gap: 6,
  },
  chatResponseText: { color: '#E6EDF3', fontSize: 13, lineHeight: 19 },
});
