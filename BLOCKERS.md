# Blockers (ship phase)

The build is complete and green locally. These two things need a human:

1. **`DOCKERHUB_TOKEN` env var is missing.** I need a Docker Hub access token
   (read/write for `bakr1m/anime-chakra` and `bakr1m/anime-chakra-lab`) in the
   environment so I can `gh secret set DOCKERHUB_TOKEN`. Please export it and
   tell me to continue.
2. **Confirm `DOCKERHUB_USER=bakr1m`.** Assumed from the kickoff variables;
   say the word if it should be something else.

## Publish actions awaiting explicit approval (one at a time)

- `gh repo create Bakr1m/anime-chakra --public ...` + topics
- `gh secret set DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`
- `gh api -X POST repos/Bakr1m/anime-chakra/pages ...`
- `git push -u origin main`
- `git tag v1.0.0` + push + `gh release create`
- README live-link update push

Nothing above has run. No code is pushed anywhere; both Docker images exist
only as local `:local` tags.
