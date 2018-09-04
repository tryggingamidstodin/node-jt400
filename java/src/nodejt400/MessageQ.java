package nodejt400;

import java.sql.Connection;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.MessageQueue;
import com.ibm.as400.access.QueuedMessage;
import com.ibm.as400.access.QSYSObjectPathName;

public class MessageQ
{
	private final ConnectionProvider connectionProvider;
	private final String path;

	public MessageQ(ConnectionProvider connectionProvider, String name, Boolean isPath)
	{
		this.connectionProvider = connectionProvider;
		if(isPath){
			this.path = name;
		}else{
			this.path = QSYSObjectPathName.toPath("*LIBL", name, "DTAQ");
		}
	}

	private MessageQueue openMessageQ(Connection c) throws Exception
	{
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) c;
		AS400 as400 = handle.getSystem();
		MessageQueue msgQ = new MessageQueue(as400, path);
		return msgQ;
	}

	public String read(int wait) throws Exception
	{
		Connection c = connectionProvider.getConnection();
		try
		{
			MessageQueue msgQ = openMessageQ(c);
			QueuedMessage entry = null;
			entry = msgQ.receive(null);
			// entry = msgQ.receive(null,wait,"*REMOVE","*ANY");
			if (entry == null)
			{
				return null;
			}
            return entry.getText();
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

	public MessageQueueResponse readResponse(int wait)
			throws Exception {
		String allData = read(wait);
		return new MessageQueueResponse(allData, this);
	}

	public void sendInformational(String messageText) throws Exception
	{
		Connection c = connectionProvider.getConnection();
		try
		{
			MessageQueue msgQ = openMessageQ(c);
			msgQ.sendInformational(messageText);
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