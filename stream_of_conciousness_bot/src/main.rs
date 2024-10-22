#[tokio::main]
async fn main() {
    stream_of_conciousness_bot::poll_once_and_update_notion()
        .await
        .unwrap();
}
