package com.healthlens.sync

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var syncButton: Button
    
    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class)
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        syncButton = findViewById(R.id.syncButton)

        val healthConnectClient = HealthConnectClient.getOrCreate(this)

        syncButton.setOnClickListener {
            checkPermissionsAndRun(healthConnectClient)
        }
    }

    private fun checkPermissionsAndRun(client: HealthConnectClient) {
        lifecycleScope.launch {
            val granted = client.permissionController.getGrantedPermissions()
            if (granted.containsAll(permissions)) {
                readAndSyncData(client)
            } else {
                statusText.text = "Status: Permissions required"
                // In a real app, we'd trigger the permission request launcher here
                Toast.makeText(this@MainActivity, "Please grant permissions in Health Connect", Toast.LENGTH_LONG).show()
            }
        }
    }

    private suspend fun readAndSyncData(client: HealthConnectClient) {
        statusText.text = "Status: Reading data..."
        
        try {
            val start = Instant.now().minus(1, ChronoUnit.DAYS)
            val end = Instant.now()

            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(start, end)
                )
            )

            val totalSteps = response.records.sumOf { it.count }
            statusText.text = "Status: Found $totalSteps steps. Syncing to HealthLens..."
            
            // TODO: POST to https://health-lens-rust.vercel.app/api/sync/health-connect
            // For now, just simulate success
            Toast.makeText(this, "Simulated sync of $totalSteps steps", Toast.LENGTH_SHORT).show()
            statusText.text = "Status: Last sync successful (${Instant.now()})"
            
        } catch (e: Exception) {
            statusText.text = "Status: Sync failed - ${e.message}"
        }
    }
}
