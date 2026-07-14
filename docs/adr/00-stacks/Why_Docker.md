### Why Docker?

The Incident Management System uses **Docker** to provide a consistent, reproducible, and isolated runtime environment across development, testing, and production.

Modern backend applications depend not only on application code but also on supporting infrastructure such as PostgreSQL, Redis, background workers, and environment-specific configurations. Docker packages these components into portable containers, ensuring that every developer and deployment environment runs the same software versions and configurations.

Docker enables IMS to run services such as:

- API Server
- PostgreSQL
- Redis
- BullMQ Worker

as independent containers that communicate through Docker networks while remaining isolated from the host operating system.

Using Docker eliminates many environment-specific issues, reduces onboarding time for new developers, simplifies CI/CD pipelines, and provides a deployment environment that closely matches production.

Compared to traditional virtual machines, Docker containers are significantly lighter because they share the host operating system kernel while maintaining process isolation. This results in faster startup times, lower resource consumption, and simpler deployment.

The project therefore prioritizes:

- Reproducible development environments.
- Consistent deployments across machines.
- Simplified dependency management.
- Easy onboarding.
- Better CI/CD integration.
- Isolation between application services.
- Containerized deployment for future cloud migration.

#### Trade-offs Accepted

- Additional tooling to learn.
- Container networking introduces extra complexity.
- Debugging inside containers can be more difficult.
- Images require maintenance and periodic security updates.

---

**Docker** is a platform for containerizing modern applications. It has become a standard in the industry, particularly for microservices and open-source projects

**The Problem Statement**  
Setting up consistent development environments across different machines is a major challenge. When different developers have varying operating systems or software versions (e.g., different Node.js or database versions), the application often fails to run due to environmental discrepancies.  
This *Docker Containers* Containers allow us to package our application along with all its required dependencies, tools, and configurations. This ensures that the application runs identically on any machine, solving the problem of environment replication. Containers are lightweight, easy to build, and portable across various systems.

**Installation and Setup**
To use Docker, us need the Docker CLI (for command-line interactions) and Docker Desktop (a GUI to manage images and containers). The system architecture consists of the Docker Daemon, which performs the heavy lifting like building and running containers, and the Docker Desktop GUI, which provides visualization of our system's state.

**Docker CLI, Images, and Containers**

- Images: Think of these as templates or operating systems that contain the necessary code and tools.
- Containers: These are running instances of images. Each container is isolated, meaning they have their own data and environment, even if they are based on the same image.
- Key Commands: Use docker run to start a new container, docker start/stop to control existing ones, and docker ps or docker container ls to list containers. The -it flag is used for interactive terminal sessions.

**Port Mapping and Environment Variables**  
Since containers are isolated, their internal ports (like a server running on port 8000) are not directly accessible from our host machine. Port mapping allows us to map a container port to a host port. Environment variables are crucial for passing configurations (like database credentials) to our application securely.

**Containerizing a Node.js Server**  
To containerize an application, us create a *Dockerfile*. This file defines the instructions to build our image, such as the base operating system, copying our source code, and installing dependencies. Docker uses "layer caching," which speeds up the build process by reusing previously built layers if the corresponding instructions haven't changed.

**Publishing to Docker Hub**  
*Docker Hub* acts like a registry for containers, similar to how GitHub works for code. us can log in to our account, create a repository, and push our custom images so that they can be pulled and used by anyone, anywhere.

**Docker Compose**  
When an application requires multiple services (e.g., a web server, a database like PostgreSQL, and a cache like Redis), managing each container individually with CLI commands becomes tedious.   
Docker Compose uses a YAML file (docker-compose.yml) to define and run multiple containers simultaneously. It simplifies the entire infrastructure setup, allowing us to spin up or tear down our entire application environment with a single command.

---