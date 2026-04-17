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
import com.aquarius.model.Community
import com.aquarius.viewmodel.MainViewModel

@Composable
fun DashboardScreen(viewModel: MainViewModel) {
    val communities = viewModel.communities.collectAsState().value
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
                text = "Aquarius",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Hybrid Human/AI Blockchain Communities",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(24.dp))
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Wallet Status", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    if (walletState.isConnected && walletState.address != null) {
                        Text("Connected: ${walletState.address?.take(6)}...${walletState.address?.takeLast(4)}")
                        Text("Balance: ${walletState.balance}")
                        Text("Chain: Anvil (${walletState.chainId})")
                    } else {
                        Button(onClick = { viewModel.connectWallet() }) {
                            Text("Connect Wallet")
                        }
                    }
                }
            }
        }

        item {
            Text(
                text = "Active Communities",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(vertical = 8.dp)
            )
        }

        items(communities) { community ->
            CommunityCard(community)
        }

        item {
            Button(
                onClick = { viewModel.refreshOnChainData() },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (isLoading) "Refreshing On-Chain Data..." else "Refresh On-Chain Data")
            }
        }
    }
}

@Composable
fun CommunityCard(community: Community) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = community.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = community.description,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(vertical = 8.dp)
            )
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    Text("Members", style = MaterialTheme.typography.labelSmall)
                    Text("${community.memberCount}", style = MaterialTheme.typography.titleMedium)
                }
                Column {
                    Text("Agents", style = MaterialTheme.typography.labelSmall)
                    Text("${community.agentCount}", style = MaterialTheme.typography.titleMedium)
                }
                Column {
                    Text("TVL", style = MaterialTheme.typography.labelSmall)
                    Text(community.totalValueLocked, style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}
