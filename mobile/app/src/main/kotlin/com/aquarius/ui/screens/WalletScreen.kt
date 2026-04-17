package com.aquarius.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.aquarius.viewmodel.MainViewModel

@Composable
fun WalletScreen(viewModel: MainViewModel) {
    val walletState = viewModel.walletState.collectAsState().value
    val isLoading = viewModel.isLoading.collectAsState().value

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Web3 Wallet",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "WalletConnect v2 • Anvil Testnet Integration",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(48.dp))

        if (walletState.isConnected) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "✅ Connected",
                        style = MaterialTheme.typography.headlineMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Address",
                        style = MaterialTheme.typography.labelLarge
                    )
                    Text(
                        text = walletState.address ?: "",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Balance: ${walletState.balance}",
                        style = MaterialTheme.typography.titleLarge
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = { viewModel.disconnectWallet() },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Disconnect Wallet")
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                "Future: Direct interaction with AgentRegistry and Governor contracts via Web3j",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        } else {
            Card(
                modifier = Modifier.fillMaxWidth(0.9f)
            ) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Connect your wallet to participate in hybrid governance",
                        style = MaterialTheme.typography.titleMedium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = { viewModel.connectWallet() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Connect with WalletConnect")
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { /* Could add other wallet options */ },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Use Test Wallet (Anvil)")
                    }
                }
            }
        }

        if (isLoading) {
            Spacer(modifier = Modifier.height(32.dp))
            CircularProgressIndicator()
            Text("Connecting to WalletConnect...", modifier = Modifier.padding(top = 16.dp))
        }

        Spacer(modifier = Modifier.height(64.dp))
        Text(
            text = "Target: Local Anvil RPC at http://127.0.0.1:8545\n" +
                  "Contracts: AgentRegistry (ERC-8004), Governor",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}
