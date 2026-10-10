# AI development notes

I used Code0 to help test ApplyBoard and work through the backend setup. My usage focused on three areas:

1. **Application testing:** I used Code0 to help check whether the main workflows behaved as expected. This covered the flow of adding an application, editing its details, and changing its status. The aim was to check that the interface and saved data stayed in sync, rather than just checking whether the page loaded.
2. **MongoDB setup:** Code0 helped me work through the database connection instructions and configuration. This included understanding where to set `MONGODB_URI`, how Express connects to MongoDB, and what to check when a connection fails. I kept the connection string in environment settings instead of adding credentials to the repository.
3. **API testing:** I used Code0 while testing requests to the Express API and checking the responses. I focused on whether requests returned the expected data and whether errors were clear enough to understand. This helped me connect what was happening in the UI with the requests handled by the backend.

## Project checks

The repository includes automated tests for CRUD, MongoDB persistence, input validation, search, and request error handling. Run them with `pnpm test`. The production build and formatting checks are available through `pnpm build` and `pnpm format:check`.
