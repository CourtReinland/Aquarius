package com.aquarius.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aquarius.ui.screens.AgentDirectoryScreen
import com.aquarius.ui.screens.DashboardScreen
import com.aquarius.ui.screens.GovernanceScreen
import com.aquarius.ui.screens.WalletScreen
import com.aquarius.viewmodel.MainViewModel

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    data object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Home)
    data object Agents : Screen("agents", "Agents", Icons.Default.List)
    data object Governance : Screen("governance", "Governance", Icons.Default.Settings)
    data object Wallet : Screen("wallet", "Wallet", Icons.Default.AccountCircle)
}

@Composable
fun AquariusApp() {
    val navController = rememberNavController()
    val viewModel: MainViewModel = viewModel()

    val items = listOf(
        Screen.Dashboard,
        Screen.Agents,
        Screen.Governance,
        Screen.Wallet
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                items.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.title) },
                        label = { Text(screen.title) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Dashboard.route) {
                DashboardScreen(viewModel)
            }
            composable(Screen.Agents.route) {
                AgentDirectoryScreen(viewModel)
            }
            composable(Screen.Governance.route) {
                GovernanceScreen(viewModel)
            }
            composable(Screen.Wallet.route) {
                WalletScreen(viewModel)
            }
        }
    }
}
