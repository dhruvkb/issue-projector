# Issue projector

Automatically find issues updated within the given time period and add them to a
GitHub Project.

## Inputs

| Input variable            | Description                                               | Required | Default |
|---------------------------|-----------------------------------------------------------|----------|---------|
| `ACCESS_TOKEN`            | An authorised Personal Access Token from GitHub           | yes      |         |
| `ORG_NAME`                | The GitHub username of the organisation                   | yes      |         |
| `PROJECT_NUMBER`          | The number of the project board within the org            | yes      |         |
| `COLUMN_NAME`             | The name of the column within the project board           | yes      |         |
| `EXCLUDED_PROJECT_NUMBER` | The number of the excluded project within the org         | no       | -1      |
| `ISSUE_TYPE`              | Whether to find new issues, PRs or both                   | no       | any     |
| `INTERVAL`                | The time interval to check for updated issues             | no       | 1       |
| `INTERVAL_UNIT`           | The unit of the time interval to check for updated issues | no       | d       |

## Testing locally

0. Clone the repo.
   ```bash
   $ gh repo clone dhruvkb/issue-projector
   ```
0. Install dependencies.
   ```bash
   $ npm install
   ```
0. Export environment variables into the current shell by creating an `.env`
   file. This variables defined in the file are a little different because we
   prepend `INPUT_` to each of the inputs that the script takes.
   ```bash
   INPUT_ACCESS_TOKEN='486aa6349a2a17a3c83b9f649c09b592a7b81368'
   INPUT_ORG_NAME='purelyfortesting'
   INPUT_PROJECT_NUMBER='1'
   INPUT_COLUMN_NAME='Pending_Review'
   INPUT_EXCLUDED_PROJECT_NUMBER='2'
   INPUT_ISSUE_TYPE='any'
   INPUT_INTERVAL='4'
   INPUT_INTERVAL_UNIT='h'
   ```
0. Run the TypeScript build server that watches the files and recompiles them
   upon changes.
   ```bash
   $ npm run watch
   ```
0. Execute the compiled script.
   ```bash
   $ npm run exec
   ```

## Branches

- `develop`: This is
  - the primary branch for the repo
  - the one to which all code is pushed 
  - the one to which all PRs should be directed to
- `master`: This is
  - *not* the primary branch of the repo, contrary to what the name implies so
  - the one to which Travis pushes the built assets
  - the one from which GitHub Releases are drafted
