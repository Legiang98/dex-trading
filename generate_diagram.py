from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import Lambda
from diagrams.aws.database import Dynamodb
from diagrams.aws.integration import SQS, Eventbridge
from diagrams.aws.network import APIGateway
from diagrams.onprem.client import User

with Diagram("HyperLiquid Trading Bot Architecture", show=False, filename="architecture", direction="LR"):
    tradingview = User("Signals\n(TradingView)")

    with Cluster("AWS Cloud"):
        with Cluster("Ingestion"):
            api_gw = APIGateway("API Gateway\n(REST)")
            gatekeeper = Lambda("Gatekeeper\n(Validation)")
            queue = SQS("SQS Queue\n(Signals)")

        with Cluster("Execution"):
            executor = Lambda("Executor\n(Trade Engine)")
            db = Dynamodb("DynamoDB\n(Orders)")

        with Cluster("Maintenance"):
            eventbridge = Eventbridge("6h Schedule")
            cleaner = Lambda("Cleaner\n(Reconciliation)")

    hl_api = User("HyperLiquid API")

    # Flow
    tradingview >> Edge(label="POST /webhook") >> api_gw >> gatekeeper >> queue >> executor
    executor >> db
    executor >> Edge(label="Trade", style="dashed") >> hl_api
    
    eventbridge >> cleaner >> db
    cleaner >> Edge(label="Reconcile", style="dashed") >> hl_api
