package com.aquarius.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aquarius.model.Agent
import com.aquarius.model.AgentStatus
import com.aquarius.model.Community
import com.aquarius.model.Proposal
import com.aquarius.model.ProposalStatus
import com.aquarius.model.WalletState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MainViewModel : ViewModel() {

    private val _walletState = MutableStateFlow(WalletState(false, null, null, null))
    val walletState: StateFlow<WalletState> = _walletState.asStateFlow()

    private val _communities = MutableStateFlow<List<Community>>(emptyList())
    val communities: StateFlow<List<Community>> = _communities.asStateFlow()

    private val _agents = MutableStateFlow<List<Agent>>(emptyList())
    val agents: StateFlow<List<Agent>> = _agents.asStateFlow()

    private val _proposals = MutableStateFlow<List<Proposal>>(emptyList())
    val proposals: StateFlow<List<Proposal>> = _proposals.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadDummyData()
        // In future: connect to Web3 layer for real data via flows
    }

    private fun loadDummyData() {
        _communities.value = listOf(
            Community(
                id = "1",
                name = "Aquarius Genesis",
                description = "Primary hybrid human/AI governance community on Base",
                memberCount = 1247,
                agentCount = 42,
                totalValueLocked = "847.3 ETH"
            ),
            Community(
                id = "2",
                name = "Neural Collective",
                description = "AI agent coordination DAO",
                memberCount = 892,
                agentCount = 28,
                totalValueLocked = "1241.5 ETH"
            )
        )

        _agents.value = listOf(
            Agent(
                id = "a1",
                name = "Echo",
                description = "Specialized in sentiment analysis and community moderation",
                avatarUrl = null,
                status = AgentStatus.ACTIVE,
                specialization = "Moderation & Analysis",
                onChainId = "ERC8004-0x7a8b9c",
                trustScore = 0.94f,
                interactions = 1248
            ),
            Agent(
                id = "a2",
                name = "Nexus",
                description = "Orchestrates cross-agent workflows and proposal synthesis",
                avatarUrl = null,
                status = AgentStatus.ACTIVE,
                specialization = "Orchestration",
                onChainId = "ERC8004-0x9d2e1f",
                trustScore = 0.89f,
                interactions = 875
            ),
            Agent(
                id = "a3",
                name = "Oracle",
                description = "Real-time on-chain data aggregator and validator",
                avatarUrl = null,
                status = AgentStatus.TRAINING,
                specialization = "Data & Validation",
                onChainId = "ERC8004-0x4f3a2b",
                trustScore = 0.91f,
                interactions = 653
            )
        )

        _proposals.value = listOf(
            Proposal(
                id = "p1",
                title = "Increase Agent Registry Threshold",
                description = "Raise minimum trust score for new agent registration to 0.85",
                status = ProposalStatus.ACTIVE,
                votesFor = 1240,
                votesAgainst = 342,
                endDate = "2 days"
            ),
            Proposal(
                id = "p2",
                title = "Integrate New Web3 Library",
                description = "Migrate from Web3j to viem-compatible bindings for better performance",
                status = ProposalStatus.PENDING,
                votesFor = 0,
                votesAgainst = 0,
                endDate = "5 days"
            )
        )
    }

    fun connectWallet() {
        _isLoading.value = true
        viewModelScope.launch {
            // Simulate WalletConnect flow
            kotlinx.coroutines.delay(1500)
            _walletState.value = WalletState(
                isConnected = true,
                address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                balance = "12.45 ETH",
                chainId = 31337 // Local Anvil
            )
            _isLoading.value = false
        }
    }

    fun disconnectWallet() {
        _walletState.value = WalletState(false, null, null, null)
    }

    fun voteOnProposal(proposalId: String, inFavor: Boolean) {
        // Simulate on-chain vote
        println("Voted on proposal $proposalId: $inFavor")
        // In real impl: would call Governor contract via Web3j
    }

    // Web3 integration placeholders
    fun refreshOnChainData() {
        // TODO: Integrate with Web3Layer to read from AgentRegistry and Governor contracts
        _isLoading.value = true
        viewModelScope.launch {
            kotlinx.coroutines.delay(800)
            _isLoading.value = false
        }
    }
}
