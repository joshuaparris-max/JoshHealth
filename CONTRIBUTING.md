# Contributing to HealthLens

Thank you for your interest in contributing to HealthLens! This project is a personal health data analysis tool designed to help users gain insights from their wearable and clinical data.

## How to Contribute

1.  **Report Bugs**: If you find a bug, please open an issue with a clear description and steps to reproduce.
2.  **Suggest Features**: Have an idea for a new feature or improvement? Open an issue to discuss it.
3.  **Submit Pull Requests**:
    - Fork the repository.
    - Create a new branch for your feature or fix.
    - Ensure your code follows the project's style and conventions.
    - Run `npm test` and `npm run build` to ensure everything is working correctly.
    - Submit a pull request with a clear description of your changes.

## Development Setup

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/joshualparris/HealthLens.git
    cd HealthLens
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
4.  **Run Tests**:
    ```bash
    npm test
    ```

## Coding Standards

- Use clean, readable code with appropriate variable names.
- Follow existing patterns for components and library functions.
- Ensure all new features are documented in the relevant `.md` files in the `docs/` folder.

## Privacy & Safety

- Never commit real API keys or health data to the repository.
- Use the `.env.example` file as a template for your local environment variables.
- HealthLens is for personal reflection only and is not medical advice.

## License

By contributing to HealthLens, you agree that your contributions will be licensed under the MIT License.
