package com.aquarius.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import com.aquarius.model.Agent
import com.aquarius.model.AgentStatus
import com.aquarius.viewmodel.MainViewModel

@Composable
fun AgentDirectoryScreen(viewModel: MainViewModel) {
    val agents = viewModel.agents.collectAsState().value
    val isLoading = viewModel.isLoading.collectAsState().value
    val walletState = viewModel.walletState.collectAsState().value

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "Agent Directory",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Registered ERC-8004 AI Agents",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))

        if (!walletState.isConnected) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
            ) {
                Text(
                    text = "Connect wallet to interact with on-chain agents",
                    modifier = Modifier.padding(16.dp)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(agents) { agent ->
                AgentCard(agent, walletState.isConnected)
            }
        }

        Button(
            onClick = { viewModel.refreshOnChainData() },
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp)
        ) {
            Icon(Icons.Default.Refresh, contentDescription = "Refresh")
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (isLoading) "Querying Registry..." else "Query Agent Registry (ERC-8004)")
        }
    }
}

@Composable
fun AgentCard(agent: Agent, isWalletConnected: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape),
                contentAlignment = Alignment.Center
            ) {
                // Placeholder avatar with first letter
                Surface(
                    modifier = Modifier.size(56.dp),
                    color = MaterialTheme.colorScheme.primary,
                    shape = CircleShape
                ) {
                    Text(
                        text = agent.name.first().toString(),
                        modifier = Modifier.padding(16.dp),
                        color = Color.White,
                        style = MaterialTheme.typography.headlineMedium
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = agent.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    StatusBadge(agent.status)
                }

                Text(
                    text = agent.description,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 2
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column {
                        Text("Trust", style = MaterialTheme.typography.labelSmall)
                        Text(
                            text = "${(agent.trustScore * 100).toInt()}%",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    Column {
                        Text("Interactions", style = MaterialTheme.typography.labelSmall)
                        Text(
                            "${agent.interactions}",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                    Column {
                        Text("On-Chain", style = MaterialTheme.typography.labelSmall)
                        Text(
                            text = agent.onChainId,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                    }
                }
            }

            if (isWalletConnected) {
                Button(
                    onClick = { /* Interact with agent - future integration */ },
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    Text("Interact")
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: AgentStatus) {
    val color = when (status) {
        AgentStatus.ACTIVE -> Color(0xFF4CAF50)
        AgentStatus.IDLE -> Color(0xFFFFC107)
        AgentStatus.OFFLINE -> Color(0xFF9E9E9E)
        AgentStatus.TRAINING -> Color(0xFF2196F3)
    }

    Surface(
        shape = MaterialTheme.shapes.small,
        color = color.copy(alpha = 0.2f),
        modifier = Modifier.padding(start = 8.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(12.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = status.name,
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
        }
    }
}
