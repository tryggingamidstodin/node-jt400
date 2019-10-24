package nodejt400;

import java.sql.Connection;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.KeyedDataQueue;
import com.ibm.as400.access.KeyedDataQueueEntry;
import com.ibm.as400.access.QSYSObjectPathName;

public class KeyedDataQ
{

	private final ConnectionProvider connectionProvider;

	private final String path;

	public KeyedDataQ(ConnectionProvider connectionProvider, String name)
	{
		this.connectionProvider = connectionProvider;
		this.path = QSYSObjectPathName.toPath("*LIBL", name, "DTAQ");
	}

	private KeyedDataQueue createDataQ(Connection c) throws Exception
	{
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) c;
		AS400 as400 = handle.getSystem();
		KeyedDataQueue dataQ = new KeyedDataQueue(as400, path);
		return dataQ;
	}

	public String read(final String key, int wait) throws Exception
	{
		Connection c = connectionProvider.getConnection();
		try
		{
			KeyedDataQueue dataQ = createDataQ(c);
			KeyedDataQueueEntry entry = dataQ.read(key, wait, "EQ");
			if (entry == null)
			{
				throw new Exception("Dataq read timeout, key: " + key + " timeout: " + wait + "s");
			}
			return entry.getString();
		}
		catch (Exception ex)
		{
			throw ex;
		}
		finally
		{
			connectionProvider.returnConnection(c);
		}
	}

	public KeyedDataQueueResponse readResponse(final String key, int wait,
			int writeKeyLength)
			throws Exception {
		String allData = read(key, wait);
		String writeKey = allData.substring(0, writeKeyLength);
		String data = allData.substring(writeKeyLength);
		return new KeyedDataQueueResponse(writeKey, data, this);
	}

	public void write(String key, String data) throws Exception
	{
		Connection c = connectionProvider.getConnection();
		try
		{
			KeyedDataQueue dataQ = createDataQ(c);
			dataQ.write(key, data);
		}
		catch (Exception ex)
		{
			throw ex;
		}
		finally
		{
			connectionProvider.returnConnection(c);
		}
	}

}