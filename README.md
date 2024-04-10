# Orders Microservice

This MS was generate with NestJS

## Installation

1. Clone Respository

2. Install dependencies

```
npm install
```

3. Create file `.env` with `env.template`

4. Run NATS Server

```
docker run -d --name nats-main -p 4222:4222 -p 6222:6222 -p 8222:8222 nats
```

5. Run migrations from Prisma

```
npx prisma migrate dev
```

6. Run App

```
npm run start:dev
```

### Author

![enter image description here](https://avatars1.githubusercontent.com/u/6466769?s=170&v=4)

- **Carlos Enrique Ramírez Flores** - _Backend Development_ - [GitHub](https://github.com/linuxcarl), [GitLab](https://gitlab.com/linux-carl), [Web Site](https://www.carlosramirezflores.com), [Linkedin](https://www.linkedin.com/in/carlos-enrique-ram%C3%ADrez-flores/)

## License

[MIT](https://choosealicense.com/licenses/mit/)
