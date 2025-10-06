export class GTDResponseValidationError extends Error {
        constructor(message: string) {
                super(message);
                this.name = 'GTDResponseValidationError';
        }
}
