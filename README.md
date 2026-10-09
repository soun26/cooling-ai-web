# Bio-inspired evolutionary cooling channels — web edition

A browser interface for exploring cooling channels for plastic injection molds.
The research focuses on complex part geometry, variable wall thickness and
temperature uniformity across successive channel designs.

[Open the web app →](https://cooling-ai-user.lengtrtien2610.workers.dev/)

[![Web interface](https://raw.githubusercontent.com/soun26/soun26/main/assets/cooling-web-rounded.svg)](https://cooling-ai-user.lengtrtien2610.workers.dev/user/)

This repository contains the web interface and its deployment gateway. The original
research application, computation service and model files are maintained separately.
Predictions require a connection to the research service.

## Source layout

- `web/` — browser pages, styles, interaction and public presentation assets.
- `deploy/cloudflare/` — gateway and deployment configuration.

To serve the interface and gateway locally, use Wrangler with
`deploy/cloudflare/wrangler.jsonc`. The `MASTER_TOKEN` binding is configured as a
deployment secret; it is not included in this repository. Running this web source
alone does not start the research computation service.

[Research overview](https://github.com/soun26/soun26/blob/main/projects/bio-inspired-cooling.md)
 · [Contact Soun](https://github.com/soun26)
