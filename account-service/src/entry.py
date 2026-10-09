"""Cloudflare Worker entrypoint: FastAPI through workers.asgi, plus the daily cron job."""

from workers import WorkerEntrypoint  # type: ignore

from account_service import jobs
from account_service.app import create_app
from account_service.services import worker_services

app = create_app()


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        import asgi  # type: ignore

        return await asgi.fetch(app, request, self.env)

    async def scheduled(self, controller, env, ctx):
        await jobs.daily(worker_services(self.env))
