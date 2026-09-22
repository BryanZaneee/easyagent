# deploy/

`runnrr.service` is the systemd unit for a cloud install (uvicorn on `127.0.0.1:8001`,
one worker; sessions and the budget are process-local by design).

Deploys are manual:

```bash
ssh <host> 'cd /opt/runnrr && git pull --ff-only && .venv/bin/uv pip install -e ".[rag]" && systemctl restart runnrr'
```

The separate public-site deployment remains frozen at commit `ed536ff`.
It is not managed by this repository.
