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

	public IfsWriteStream(ConnectionProvider connectionProvider, String folderPath, String fileName, boolean append, Integer ccsid)
			throws Exception {
		this.connectionProvider = connectionProvider;
		connection = connectionProvider.getConnection();
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
		AS400 as400 = handle.getSystem();
		IFSFile folder = new IFSFile(as400,folderPath);
		if (!folder.exists()) {
			folder.mkdirs();			
		}
		
		IFSFile file = new IFSFile(as400, folder, fileName);

    if (ccsid == null) {
      System.out.println("Not using ccsid");
      fos = new IFSFileOutputStream(file, IFSFileOutputStream.SHARE_ALL, append);  
    }
    else {
      System.out.println("Using ccsid");
      fos = new IFSFileOutputStream(file, IFSFileOutputStream.SHARE_ALL, append, ccsid.intValue());
    }
	}

	public void write(byte[] data) throws Exception {				
		fos.write(data);				
		fos.flush();
	}

	public void flush() throws Exception {		
		fos.flush();
		fos.close();
		this.connectionProvider.returnConnection(this.connection);
	}
}
