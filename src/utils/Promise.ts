/** 指定された時間待ちます。 */
export async function wait(milliseconds: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}