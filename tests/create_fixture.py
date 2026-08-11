import sqlite3
import zipfile
import os

def create_db(name, num_hrv, num_rhr, num_sleep):
    db_path = f'{name}.db'
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''CREATE TABLE heart_rate_variability_rmssd_record_table 
                 (uuid BLOB, time INTEGER, heart_rate_variability_millis REAL, client_record_id TEXT, app_info_id TEXT)''')
    c.execute('''CREATE TABLE resting_heart_rate_record_table 
                 (uuid BLOB, time INTEGER, beats_per_minute REAL, client_record_id TEXT, app_info_id TEXT)''')
    c.execute('''CREATE TABLE sleep_session_record_table 
                 (uuid BLOB, start_time INTEGER, end_time INTEGER, client_record_id TEXT)''')
    
    base_time = 1785585600000 # 2026-08-01 12:00:00 UTC = 22:00:00 Sydney
    
    for i in range(num_hrv):
        c.execute("INSERT INTO heart_rate_variability_rmssd_record_table VALUES (?, ?, ?, ?, ?)", 
                  (b'uuid'+str(i).encode(), base_time + i*3600000, 50.0 + i, f"client_{i}", f"app_{i}"))
                  
    for i in range(num_rhr):
        c.execute("INSERT INTO resting_heart_rate_record_table VALUES (?, ?, ?, ?, ?)", 
                  (b'rhr_uuid'+str(i).encode(), base_time + i*3600000, 60.0 + i, f"rhr_client_{i}", f"app_{i}"))
                  
    for i in range(num_sleep):
        c.execute("INSERT INTO sleep_session_record_table VALUES (?, ?, ?, ?)", 
                  (b'sleep_uuid'+str(i).encode(), base_time + i*86400000, base_time + i*86400000 + 28800000, f"sleep_client_{i}"))
                  
    conn.commit()
    conn.close()
    
    zip_path = f'C:/dev/HealthLens/tests/{name}.zip'
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        z.write(db_path, 'health_connect_export.db')
        
    os.remove(db_path)

if __name__ == '__main__':
    create_db('tiny_fixture', 10, 10, 2)
    create_db('medium_fixture', 10000, 10000, 30)
