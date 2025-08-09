use std::env;
use std::fs;
use std::path::Path;

fn main() {
    // Copy server_dist to target directory if it exists
    if let Ok(out_dir) = env::var("OUT_DIR") {
        // OUT_DIR is something like target/debug/build/phlox-xxx/out
        // We need to get to target/debug
        let target_dir = Path::new(&out_dir)
            .ancestors()
            .find(|p| {
                p.file_name()
                    .map_or(false, |name| name == "debug" || name == "release")
            })
            .expect("Could not find target directory");

        let server_dist_src = Path::new("server_dist");
        let server_dist_dest = target_dir.join("server_dist");

        if server_dist_src.exists() {
            // Remove existing server_dist in target directory
            if server_dist_dest.exists() {
                let _ = fs::remove_dir_all(&server_dist_dest);
            }

            // Copy server_dist to target directory
            if let Err(e) = copy_dir_all(&server_dist_src, &server_dist_dest) {
                println!("cargo:warning=Failed to copy server_dist: {}", e);
            } else {
                println!("cargo:warning=Copied server_dist to {:?}", server_dist_dest);
            }
        }

        // Copy Ollama binary to target directory
        let ollama_src = if cfg!(target_os = "windows") {
            Path::new("ollama.exe")
        } else {
            Path::new("ollama")
        };

        if ollama_src.exists() {
            let ollama_dest = target_dir.join(ollama_src.file_name().unwrap());
            if let Err(e) = fs::copy(&ollama_src, &ollama_dest) {
                println!("cargo:warning=Failed to copy Ollama binary: {}", e);
            } else {
                println!("cargo:warning=Copied Ollama binary to {:?}", ollama_dest);
                // Make sure it's executable on Unix systems
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = fs::metadata(&ollama_dest).unwrap().permissions();
                    perms.set_mode(0o755);
                    let _ = fs::set_permissions(&ollama_dest, perms);
                }
            }
        } else {
            println!("cargo:warning=Ollama binary not found at {:?}", ollama_src);
        }
    }

    tauri_build::build()
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}
