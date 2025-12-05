use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::{fs::File, io::BufReader, sync::{Arc, Mutex}, time::Duration};
use tauri::{Emitter, State};

/// Shared audio playback state managed on the Rust side.
pub struct AudioState {
    _stream: OutputStream,
    stream_handle: OutputStreamHandle,
    sink: Sink,
    current_file: Option<String>,
    volume: f32,
}

#[derive(serde::Serialize)]
struct AudioEventPayload {
    status: String,
    file_path: Option<String>,
    position: Option<f32>,
    volume: Option<f32>,
}

fn emit_audio_state(app: &tauri::AppHandle, payload: AudioEventPayload) {
    let _ = app.emit("native-audio://state", payload);
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command(rename_all = "camelCase")]
fn play_song(
    app: tauri::AppHandle,
    state: State<Arc<Mutex<AudioState>>>,
    file_path: String,
) -> Result<(), String> {
    let mut audio = state
        .lock()
        .map_err(|e| format!("Mutex lock error: {}", e))?;

    let file = File::open(&file_path).map_err(|e| format!("File opening error: {}", e))?;
    let decoder = Decoder::new(BufReader::new(file))
        .map_err(|e| format!("Decoder error: {}", e))?;

    let mut new_sink = Sink::try_new(&audio.stream_handle)
        .map_err(|e| format!("Sink creation error: {}", e))?;
    new_sink.set_volume(audio.volume);
    new_sink.append(decoder);

    audio.sink.stop();
    audio.sink = new_sink;
    audio.current_file = Some(file_path.clone());

    emit_audio_state(
        &app,
        AudioEventPayload {
            status: "playing".to_string(),
            file_path: Some(file_path),
            position: Some(0.0),
            volume: Some(audio.volume),
        },
    );

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn pause_song(app: tauri::AppHandle, state: State<Arc<Mutex<AudioState>>>) -> Result<(), String> {
    let mut audio = state
        .lock()
        .map_err(|e| format!("Mutex lock error: {}", e))?;

    audio.sink.pause();

    emit_audio_state(
        &app,
        AudioEventPayload {
            status: "paused".to_string(),
            file_path: audio.current_file.clone(),
            position: None,
            volume: Some(audio.volume),
        },
    );

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn resume_song(app: tauri::AppHandle, state: State<Arc<Mutex<AudioState>>>) -> Result<(), String> {
    let mut audio = state
        .lock()
        .map_err(|e| format!("Mutex lock error: {}", e))?;

    audio.sink.play();

    emit_audio_state(
        &app,
        AudioEventPayload {
            status: "playing".to_string(),
            file_path: audio.current_file.clone(),
            position: None,
            volume: Some(audio.volume),
        },
    );

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn stop_song(app: tauri::AppHandle, state: State<Arc<Mutex<AudioState>>>) -> Result<(), String> {
    let mut audio = state
        .lock()
        .map_err(|e| format!("Mutex lock error: {}", e))?;

    audio.sink.stop();
    audio.sink = Sink::try_new(&audio.stream_handle)
        .map_err(|e| format!("Sink creation error: {}", e))?;
    audio.current_file = None;

    emit_audio_state(
        &app,
        AudioEventPayload {
            status: "stopped".to_string(),
            file_path: None,
            position: None,
            volume: Some(audio.volume),
        },
    );

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn set_volume(
    app: tauri::AppHandle,
    state: State<Arc<Mutex<AudioState>>>,
    level: f32,
) -> Result<(), String> {
    let clamped = level.clamp(0.0, 1.0);
    let mut audio = state
        .lock()
        .map_err(|e| format!("Mutex lock error: {}", e))?;

    audio.volume = clamped;
    audio.sink.set_volume(clamped);

    emit_audio_state(
        &app,
        AudioEventPayload {
            status: "volume".to_string(),
            file_path: audio.current_file.clone(),
            position: None,
            volume: Some(clamped),
        },
    );

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn seek_to(
    app: tauri::AppHandle,
    state: State<Arc<Mutex<AudioState>>>,
    position_seconds: f32,
) -> Result<(), String> {
    let mut audio = state
        .lock()
        .map_err(|e| format!("Mutex lock error: {}", e))?;

    let file_path = audio
        .current_file
        .clone()
        .ok_or_else(|| "No track loaded".to_string())?;

    let file = File::open(&file_path).map_err(|e| format!("File opening error: {}", e))?;
    let decoder = Decoder::new(BufReader::new(file))
        .map_err(|e| format!("Decoder error: {}", e))?;

    let skipped = decoder.skip_duration(Duration::from_secs_f32(position_seconds.max(0.0)));

    let mut new_sink = Sink::try_new(&audio.stream_handle)
        .map_err(|e| format!("Sink creation error: {}", e))?;
    new_sink.set_volume(audio.volume);
    new_sink.append(skipped);

    audio.sink.stop();
    audio.sink = new_sink;

    emit_audio_state(
        &app,
        AudioEventPayload {
            status: "seeking".to_string(),
            file_path: Some(file_path),
            position: Some(position_seconds.max(0.0)),
            volume: Some(audio.volume),
        },
    );

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (stream, stream_handle) = OutputStream::try_default()
        .expect("Failed to open audio output stream");
    let sink = Sink::try_new(&stream_handle).expect("Failed to create audio sink");

    let audio_state = Arc::new(Mutex::new(AudioState {
        _stream: stream,
        stream_handle,
        sink,
        current_file: None,
        volume: 1.0,
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(audio_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            play_song,
            pause_song,
            resume_song,
            stop_song,
            set_volume,
            seek_to
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
