# Exercise 0: Set up

**Time:** 5 minutes
**Objective:** get a working copy and confirm that the parser, estimator, and generator tests pass on your machine.
**Prerequisites:** Git, Node.js 22 or newer, and a POSIX shell (Git Bash on Windows). See the [lab overview](README.md#prerequisites).

## Steps

1. Clone the repository and go into it:

   ```bash
   git clone https://github.com/kenwalger/cellar-api.git
   cd cellar-api
   ```

2. Check your Node.js version. It must be 22 or newer:

   ```bash
   node --version
   ```

3. Run the three JavaScript test suites. None of them needs `npm install`, a network connection, or a Google account:

   ```bash
   cd parser && npm test && cd ..
   cd production && npm test && cd ..
   cd apps-script && npm test && cd ..
   ```

   *Expected:* each suite ends with a summary in which `fail` is `0`.

4. Create the scratch folder for your copies and outputs. Git ignores it:

   ```bash
   mkdir -p lab-work
   ```

5. *Optional:* to run the fictional winery API that the course teaches, install [uv](https://docs.astral.sh/uv/) and follow [Running the API](https://github.com/kenwalger/cellar-api/blob/main/README.md#running-the-api). The lab doesn't need it.

## Reflection

- The tests run without installing anything or contacting a service. Why does that matter for a tool whose output people need to trust?

## Completion criterion

All three test suites report `fail 0`, and `lab-work/` exists at the repository root.

## Evidence to capture

Nothing yet. If a suite fails, keep its output for [troubleshooting](troubleshooting.md).

**Next:** [Exercise 1: Inspect the source](01-inspect-the-source.md)
