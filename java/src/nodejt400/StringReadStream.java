package nodejt400;
public interface StringReadStream
{
	public String getMetaData() throws Exception;
	public String read() throws Exception;
	public void close() throws Exception;
}