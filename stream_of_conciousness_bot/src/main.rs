#[tokio::main]
async fn main() {
    pretty_env_logger::init_timed();
    stream_of_conciousness_bot::poll_once_and_update_notion()
        .await
        .unwrap();
}
