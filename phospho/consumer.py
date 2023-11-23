from .log_queue import LogQueue
from .client import Client

import time
import atexit
from threading import Thread

import logging

logger = logging.getLogger("phospho")


class Consumer(Thread):
    """This sends periodically the accumulated logs to the backend."""

    def __init__(
        self,
        log_queue: LogQueue,
        client: Client,
        verbose: bool = True,
        tick: float = 0.5,  # How often to try to send logs
    ):
        self.running = True
        self.log_queue = log_queue
        self.client = client
        self.verbose = verbose
        self.tick = tick

        Thread.__init__(self, daemon=True)
        atexit.register(self.stop)

    def run(self):
        while self.running:
            self.send_batch()
            time.sleep(self.tick)

        self.send_batch()

    def send_batch(self):
        batch = self.log_queue.get_batch()

        if len(batch) > 0:
            if self.verbose:
                logger.debug(f"Sending {len(batch)} logs to {self.client.base_url}")

            try:
                self.client._post("log", {"batch": batch})
            except Exception as e:
                if self.verbose:
                    logger.warning(
                        f"Error sending events: {e}. Retrying in {self.tick}s"
                    )

                self.log_queue.append(batch)

    def stop(self):
        self.running = False
        self.join()
