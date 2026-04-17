package com.aquarius.model

import androidx.compose.ui.graphics.Color

data class Agent(
    val id: String,
    val name: String,
    val description: String,
    val avatarUrl: String?,
    val status: AgentStatus,
    val specialization: String,
    val onChainId: String, // ERC-8004 related identifier
    val trustScore: Float,
    val interactions: Int
)

enum class AgentStatus {
    ACTIVE, IDLE, OFFLINE, TRAINING
}

data class Community(
    val id: String,
    val name: String,
    val description: String,
    val memberCount: Int,
    val agentCount: Int,
    val totalValueLocked: String
)

data class Proposal(
    val id: String,
    val title: String,
    val description: String,
    val status: ProposalStatus,
    val votesFor: Int,
    val votesAgainst: Int,
    val endDate: String
)

enum class ProposalStatus {
    ACTIVE, PASSED, REJECTED, PENDING
}

data class WalletState(
    val isConnected: Boolean,
    val address: String?,
    val balance: String?,
    val chainId: Int?
)
