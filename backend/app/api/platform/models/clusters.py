from pydantic import BaseModel
from typing import List, Literal, Optional
from phospho.models import Cluster, Clustering, ProjectDataFilters


class Clusters(BaseModel):
    clusters: List[Cluster]


class Clusterings(BaseModel):
    clusterings: List[Clustering]


class ClusteringRequest(BaseModel):
    project_id: str
    org_id: str
    limit: Optional[int] = 2000
    filters: ProjectDataFilters
    scope: Literal["messages", "sessions"] = "messages"
    instruction: Optional[str] = "user intent"
    model: Literal["intent-embed", "intent-embed-2", "intent-embed-3"] = (
        "intent-embed-3"
    )
    nb_credits_used: int
    nb_clusters: Optional[int] = None
