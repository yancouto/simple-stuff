This bot reads messages from Telegram and sends to a Notion database. It is a bit hardcoded for me.
For now, when you run it, it just does the pending messages then exits.

## Running in AWS Lambda

To run in Lambda, use the package in the `lambda_executor` directory. In Linux or WSL (Windows crosscompiling is **not** working) do:

```
cd lambda_executor
cargo build --release
cp target/release/lambda_executor bootstrap
zip lambda.zip bootstrap
```

Then upload the `lambda.zip` to AWS Lambda. It requires using the EventBridge thing for scheduling, but that can probably be easily changed.