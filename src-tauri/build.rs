fn main() {
    tauri_build::build();
    println!("cargo:rerun-if-changed=../process-manager/src");
}
