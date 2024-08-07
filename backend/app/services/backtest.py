from typing import Iterator, List, Optional
from app.services.mongo.extractor import ExtractorClient
from app.services.mongo.tasks import get_all_tasks
import phospho
from app.api.v2.models import LogEvent


class BacktestLoader:
    sampled_tasks: Optional[Iterator[phospho.lab.Message]]
    sample_size: int

    def __init__(
        self,
        project_id: str,
    ):
        self.sampled_tasks = None
        self.project_id = project_id
        self.sample_size = 0

    async def __aiter__(self):
        return self

    async def __anext__(self) -> phospho.lab.Message:
        if self.sampled_tasks is None:
            # Fetch tasks
            # TODO : Add filter on version_id
            tasks = await get_all_tasks(project_id=self.project_id)
            messages: List[phospho.lab.Message] = []
            for task in tasks:
                # Convert to a lab.Message
                message = phospho.lab.Message(
                    role="user",
                    content=task.input,
                    metadata={
                        "task_id": task.id,
                        "test_id": task.test_id,
                    },
                )
                messages.append(message)
            self.sample_size = len(messages)
            self.sampled_tasks = iter(messages)

        return next(self.sampled_tasks)

    def __len__(self) -> int:
        return self.sample_size


async def run_backtests(
    system_prompt_template: str,
    system_prompt_variables: dict,
    provider_and_model: str,
    version_id: str,
    project_id: str,
    org_id: str,
) -> None:
    provider, model = phospho.lab.get_provider_and_model(provider_and_model)
    client = phospho.lab.get_async_client(provider)

    messages: Iterator[phospho.lab.Message] = BacktestLoader(project_id=project_id)

    extractor_client = ExtractorClient(
        project_id=project_id,
        org_id=org_id,
    )

    async def run_model(message: phospho.lab.Message) -> None:
        system_prompt = system_prompt_template.format(**system_prompt_variables)
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": message.role, "content": message.content},
            ],
        )
        response_text = response.choices[0].message.content
        phospho.log(
            input=message.content,
            output=response_text,
            version_id=version_id,
        )
        logs_to_process = [
            LogEvent(
                project_id=project_id,
                input=message.content,
                output="input",
            )
        ]
        await extractor_client.run_log_process_for_tasks(logs_to_process)

    workload = phospho.lab.Workload(jobs=[run_model])
    workload.run(
        messages=messages,
        executor_type="parallel",
        max_parallelism=20,
    )

    return None
