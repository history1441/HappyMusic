use reqwest::Client;
use std::fs::File;
use std::io::{self, Read, Write};
use tauri::State;

#[derive(Clone)]
pub struct DownloadState {
    client: Client,
}

impl DownloadState {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }
}

#[tauri::command]
pub async fn download_file(url: String, path: String, state: DownloadState) -> Result<u64, String> {
    // Follow redirects manually to handle 302
    let resp = state.client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    // Get content length for progress tracking
    let total_size = resp.content_length().unwrap_or(0);

    // Stream to file
    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();

    loop {
        let chunk = stream
            .next()
            .await
            .ok_or("Unexpected end of stream")
            .map_err(|e| e.to_string())?;

        match chunk {
            Ok(bytes) => {
                file.write_all(&bytes).map_err(|e| e.to_string())?;
                downloaded += bytes.len() as u64;
            }
            Err(e) => return Err(e.to_string()),
        }

        if total_size > 0 && downloaded >= total_size {
            break;
        }
    }

    file.flush().map_err(|e| e.to_string())?;
    Ok(downloaded)
}
