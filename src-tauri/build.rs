use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-changed=../process-manager/src");

    // Get the output directory (where the phlox binary will be)
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    // In release mode, the process manager binary will be built
    // We need to copy it to the same directory as the phlox binary
    let profile = env::var("PROFILE").unwrap();
    let target_dir = out_dir
        .ancestors()
        .nth(3) // Go up from target/<profile>/build/<out_dir>
        .unwrap();

    let pm_binary = if cfg!(windows) {
        "phlox-pm.exe"
    } else {
        "phlox-pm"
    };

    let pm_source = target_dir.join(&profile).join(pm_binary);
    let pm_dest = target_dir.join(&profile).join(pm_binary);

    // Only copy in release mode or if explicitly enabled
    if profile == "release" || env::var("PHLOX_BUILD_PM").is_ok() {
        if pm_source.exists() {
            println!(
                "cargo:warning=Copying process manager binary from {:?}",
                pm_source
            );
            match fs::copy(&pm_source, &pm_dest) {
                Ok(_) => {
                    println!("cargo:warning=Process manager binary copied successfully");
                }
                Err(e) => {
                    println!("cargo:warning=Failed to copy process manager binary: {}", e);
                }
            }
        } else {
            println!(
                "cargo:warning=Process manager binary not found at {:?}",
                pm_source
            );
            println!("cargo:warning=Run `cargo build --release -p phlox-pm` first");
        }
    }
}
