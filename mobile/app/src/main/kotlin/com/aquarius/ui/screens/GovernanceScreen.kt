package com.aquarius.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aquarius.model.Proposal
import com.aquarius.model.ProposalStatus
import com.aquarius.viewmodel.MainViewModel

@Composable
fun GovernanceScreen(viewModel: MainViewModel) {
    val proposals = viewModel.proposals.collectAsState().value
    val walletState = viewModel.walletState.collectAsState().value
    val isLoading = viewModel.isLoading.collectAsState().value

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "Governance",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Aquarius Governor • ERC-8004 Registry Proposals",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            if (walletState.isConnected) {
                Text(
                    text = "Connected as ${walletState.address?.take(8)}...",
                    style = MaterialTheme.typography.labelMedium
                )
            } else {
                Text("Connect wallet to vote on proposals", color = MaterialTheme.colorScheme.error)
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        items(proposals) { proposal ->
            ProposalCard(proposal, walletState.isConnected) { inFavor ->
                viewModel.voteOnProposal(proposal.id, inFavor)
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "How it works",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "• Agents registered via ERC-8004 can propose and vote\n" +
                        "• Human members vote with governance tokens\n" +
                        "• Hybrid consensus blends on-chain votes with AI recommendations",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}

@Composable
fun ProposalCard(
    proposal: Proposal,
    isWalletConnected: Boolean,
    onVote: (Boolean) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = proposal.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                StatusChip(proposal.status)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = proposal.description,
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("For", color = MaterialTheme.colorScheme.primary)
                    Text(
                        "${proposal.votesFor}",
                        style = MaterialTheme.typography.headlineSmall
                    )
                }
                Column {
                    Text("Against", color = MaterialTheme.colorScheme.error)
                    Text(
                        "${proposal.votesAgainst}",
                        style = MaterialTheme.typography.headlineSmall
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Ends in", style = MaterialTheme.typography.labelSmall)
                    Text(proposal.endDate, style = MaterialTheme.typography.titleSmall)
                }
            }

            if (isWalletConnected && proposal.status == ProposalStatus.ACTIVE) {
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Button(
                        onClick = { onVote(true) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("Vote For")
                    }
                    OutlinedButton(
                        onClick = { onVote(false) },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Vote Against")
                    }
                }
            }
        }
    }
}

@Composable
fun StatusChip(status: ProposalStatus) {
    val (color, text) = when (status) {
        ProposalStatus.ACTIVE -> MaterialTheme.colorScheme.primary to "ACTIVE"
        ProposalStatus.PASSED -> Color(0xFF4CAF50) to "PASSED"
        ProposalStatus.REJECTED -> MaterialTheme.colorScheme.error to "REJECTED"
        ProposalStatus.PENDING -> MaterialTheme.colorScheme.secondary to "PENDING"
    }

    Surface(
        shape = MaterialTheme.shapes.small,
        color = color.copy(alpha = 0.1f),
        contentColor = color
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall
        )
    }
}
