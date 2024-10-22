use aws_lambda_events::event::eventbridge::EventBridgeEvent;
use lambda_runtime::{
    run, service_fn,
    tracing::{self, debug},
    Error, LambdaEvent,
};

async fn function_handler(event: LambdaEvent<EventBridgeEvent>) -> Result<(), Error> {
    debug!("Received event: {:?}", event);

    stream_of_conciousness_bot::poll_once_and_update_notion().await?;

    // TODO: Return more useful information
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing::init_default_subscriber();

    run(service_fn(function_handler)).await
}
