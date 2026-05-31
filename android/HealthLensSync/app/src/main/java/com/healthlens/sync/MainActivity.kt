package com.healthlens.sync

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.OffsetDateTime

class MainActivity : AppCompatActivity() {
    private val defaultEndpoint = "https://health-lens-rust.vercel.app/api/sync/health-connect"

    private lateinit var endpointInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var syncButton: Button
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        endpointInput = findViewById(R.id.endpointInput)
        tokenInput = findViewById(R.id.tokenInput)
        syncButton = findViewById(R.id.syncButton)
        statusText = findViewById(R.id.statusText)

        endpointInput.setText(defaultEndpoint)
        syncButton.setOnClickListener { sendManualTestSync() }
    }

    private fun sendManualTestSync() {
        val endpoint = endpointInput.text.toString().trim()
        val token = tokenInput.text.toString().trim()

        if (endpoint.isBlank()) {
            statusText.text = "Endpoint is required."
            return
        }
        if (token.isBlank()) {
            statusText.text = "Sync token is required."
            return
        }

        syncButton.isEnabled = false
        statusText.text = "Sending manual test payload..."

        Thread {
            val result = runCatching { postSync(endpoint, token) }
                .fold(
                    onSuccess = { it },
                    onFailure = { "ERROR: ${it.message ?: it.javaClass.simpleName}" }
                )

            runOnUiThread {
                statusText.text = result
                syncButton.isEnabled = true
            }
        }.start()
    }

    private fun postSync(endpoint: String, token: String): String {
        val today = LocalDate.now().toString()
        val payload = JSONObject()
            .put("deviceIdHash", "android-manual-test")
            .put("dateRange", JSONObject().put("start", today).put("end", today))
            .put("dailySummaries", JSONArray().put(
                JSONObject()
                    .put("date", today)
                    .put("timezone", "Australia/Sydney")
                    .put("steps", 8200)
                    .put("sleep_minutes", 430)
                    .put("hrv_rmssd", 42)
                    .put("resting_hr", 58)
                    .put("respiratory_rate", 15.4)
                    .put("weight_kg", 77.2)
                    .put("exercise_minutes", 38)
                    .put("distance_m", 6200)
                    .put("active_minutes", 65)
                    .put("source_confidence", 0.92)
                    .put("sources", JSONObject().put("android_manual_test", true))
                    .put("warnings", JSONArray().put("Manual Android test payload, not Health Connect data."))
            ))
            .put("syncStartedAt", OffsetDateTime.now().toString())
            .put("appVersion", "HealthLensSync/0.2.0")

        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15000
            readTimeout = 20000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }

        OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
            writer.write(payload.toString())
        }

        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()

        return "HTTP $status\n$body"
    }
}
