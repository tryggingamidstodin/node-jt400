package nodejt400;

import java.sql.Connection;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.IFSFile;
import com.ibm.as400.access.IFSFileOutputStream;

public class IfsWriteStream {

	private ConnectionProvider connectionProvider;
	private final Connection connection;	
	private final IFSFileOutputStream fos;

	public IfsWriteStream(ConnectionProvider connectionProvider, String fileName, boolean append)
			throws Exception {
		this.connectionProvider = connectionProvider;
		connection = connectionProvider.getConnection();
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
		AS400 as400 = handle.getSystem();
		IFSFile file = new IFSFile(as400, fileName);
		fos = new IFSFileOutputStream(file, IFSFileOutputStream.SHARE_ALL, append);
	}

	public void write(String data) throws Exception {
		fos.write(data.getBytes());
		fos.flush();
	}

	public void flush() throws Exception {
		fos.flush();
		fos.close();
		this.connectionProvider.returnConnection(this.connection);
	}
}
